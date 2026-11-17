import {
  sso,
  type SSOUserResolutionContext,
  type SSOUserResolutionInput,
  type SSOUserResolution,
} from "@better-auth/sso";
import { createAuthEndpoint } from "@better-auth/core/api";
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Data, Effect, Option, Schema } from "effect";
import {
  AuthRedirectURLFromString,
  SignInSsoPayload,
  SsoPublicConfig,
  SsoDiscoveryQuery,
  OrganizationSsoQuery,
  OrganizationSsoEnabled,
  OrganizationSsoConnection,
} from "@krak-stack/auth/auth";
import {
  SsoBinding,
  SsoAccount,
  SsoLocalUser,
  SsoMember,
  SsoSettingsBody,
} from "./schema";
import { EmailAddress } from "@krak-stack/auth/schema";
import { getAuthoritativeSessionFromCtx } from "better-auth/api";
import {
  OrganizationSso,
  SsoSettingsError,
  encryptSsoConfig,
  decryptSsoConfig,
} from "./settings";
import { runWithDatabase } from "@/services/database";

const runSettings = <A, E>(effect: Effect.Effect<A, E, OrganizationSso>) =>
  runWithDatabase(
    effect.pipe(
      Effect.provide(OrganizationSso.layer),
      Effect.mapError((error) =>
        error instanceof SsoSettingsError
          ? new APIError(error.status, {
              message: "Organization SSO request could not be completed",
            })
          : new APIError("INTERNAL_SERVER_ERROR", {
              message: "Organization SSO request failed",
            }),
      ),
    ),
  );

class SsoResolutionError extends Data.TaggedError("SsoResolutionError")<{}> {}

const settingsResponse = (
  baseURL: string,
  connection: typeof OrganizationSsoConnection.Type | null,
) =>
  connection
    ? {
        ...connection,
        callbackURL: `${baseURL}/sso/callback/${connection.providerId}`,
      }
    : null;

const rejected = (): SSOUserResolution => ({
  action: "reject",
  code: "SSO_MEMBERSHIP_REQUIRED",
});

// Use Better Auth's transaction-bound adapter here, not a second SQL connection:
// these checks must share the account-link/session transaction owned by SSO.
export const resolveSsoUser = Effect.fn("Auth.resolveSsoUser")(function* (
  input: SSOUserResolutionInput,
  context: SSOUserResolutionContext,
) {
  const binding = yield* Effect.tryPromise({
    try: () =>
      context.database.findOne({
        model: "ssoProvider",
        where: [{ field: "providerId", value: input.providerId }],
      }),
    catch: () => new SsoResolutionError(),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.NullOr(SsoBinding))),
  );
  if (!binding || !binding.enabled || !binding.domainVerified)
    return rejected();
  const config = binding;
  if (
    input.protocol !== "oidc" ||
    input.providerId !== config.providerId ||
    input.accountKey.issuer !== config.issuer
  )
    return rejected();
  const claims = Schema.decodeUnknownOption(
    Schema.Struct({
      iss: Schema.Literal(config.issuer),
      sub: Schema.Literal(input.accountKey.accountId),
    }).annotate({ identifier: "SsoVerifiedClaims" }),
  )(input.verifiedIdTokenClaims);
  if (Option.isNone(claims)) return rejected();

  const findOne = (
    model: string,
    where: Parameters<typeof context.database.findOne>[0]["where"],
  ) =>
    Effect.tryPromise({
      try: () => context.database.findOne({ model, where }),
      catch: () => new SsoResolutionError(),
    });
  const account = yield* findOne("account", [
    { field: "providerId", value: input.providerId },
    { field: "accountId", value: input.accountKey.accountId },
  ]).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.NullOr(SsoAccount))),
  );

  const email = input.providerUser.email.toLowerCase();
  if (!account && Option.isNone(Schema.decodeOption(EmailAddress)(email)))
    return rejected();
  if (!account && email.split("@")[1] !== config.domain) return rejected();
  const user = yield* findOne("user", [
    {
      field: account ? "id" : "email",
      value: account ? account.userId : email,
    },
  ]).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.NullOr(SsoLocalUser))),
  );
  if (!user || user.isAnonymous || (!account && !user.emailVerified))
    return rejected();
  const member = yield* findOne("member", [
    { field: "organizationId", value: config.organizationId },
    { field: "userId", value: user.id },
  ]).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.NullOr(SsoMember))));
  if (!member) return rejected();
  return {
    action: "link",
    userId: user.id,
    profile: "preserve",
  } satisfies SSOUserResolution;
});

export const organizationSso = (
  applicationOrigins: (
    request?: Request,
  ) => Promise<readonly string[]> = async () => [],
) => {
  const plugin = sso({
    providersLimit: 0,
    domainVerification: { enabled: true },
    disableImplicitSignUp: true,
    organizationProvisioning: { disabled: true },
    schema: {
      ssoProvider: {
        additionalFields: {
          enabled: {
            type: "boolean",
            required: false,
            defaultValue: false,
            input: false,
            returned: false,
          },
        },
      },
    },
    resolveUser: async (input, context) => {
      const resolution = await Effect.runPromise(
        resolveSsoUser(input, context),
      );
      if (resolution.action === "link") {
        const endpoint = tryGetCurrentAuthEndpointContext();
        if (!endpoint) return rejected();
        const binding = await context.database.findOne({
          model: "ssoProvider",
          where: [{ field: "providerId", value: input.providerId }],
        });
        const config = Schema.decodeUnknownSync(SsoBinding)(binding);
        Object.assign(endpoint.context, {
          krakstackSsoSession: {
            userId: resolution.userId,
            organizationId: config.organizationId,
          },
        });
      }
      return resolution;
    },
  });

  // Better Auth must only ever see decrypted OIDC data through its adapter.
  // Native provider-management endpoints are not exposed; settings use Effect SQL.
  plugin.schema.ssoProvider.fields.oidcConfig.transform = {
    input: async (value) =>
      value == null
        ? value
        : Effect.runPromise(
            encryptSsoConfig(Schema.decodeUnknownSync(Schema.String)(value)),
          ),
    output: async (value) =>
      value == null
        ? value
        : Effect.runPromise(
            decryptSsoConfig(Schema.decodeUnknownSync(Schema.String)(value)),
          ),
  };

  const requireActor = async (
    ctx: Parameters<typeof getAuthoritativeSessionFromCtx>[0],
  ) => {
    const session = await getAuthoritativeSessionFromCtx(ctx);
    if (!session)
      throw new APIError("UNAUTHORIZED", { message: "Session required" });
    const ordinary = Schema.decodeUnknownOption(
      Schema.Struct({
        impersonatedBy: Schema.optional(Schema.NullOr(Schema.Literal(""))),
        impersonatedByOrganizationId: Schema.optional(
          Schema.NullOr(Schema.Literal("")),
        ),
      }),
    )(session.session);
    if (Option.isNone(ordinary))
      throw new APIError("FORBIDDEN", { message: "Member session required" });
    return session.user.id;
  };

  return {
    ...plugin,
    // Keep native registration/mutation APIs private so callers cannot bypass
    // organization binding, encrypted storage, verification or immutable identity.
    endpoints: {
      signInSSO: plugin.endpoints.signInSSO,
      callbackSSO: plugin.endpoints.callbackSSO,
      getSsoConfig: createAuthEndpoint(
        "/sso/config",
        {
          method: "GET",
          query: Schema.toStandardSchemaV1(SsoDiscoveryQuery),
          metadata: {
            openapi: {
              summary: "Get available organization SSO",
              responses: {},
            },
          },
        },
        async (ctx) =>
          ctx.json(
            Schema.decodeSync(SsoPublicConfig)(
              await runSettings(
                OrganizationSso.use((service) => service.discover(ctx.query)),
              ),
            ),
          ),
      ),
      getOrganizationSso: createAuthEndpoint(
        "/organization/sso",
        {
          method: "GET",
          query: Schema.toStandardSchemaV1(OrganizationSsoQuery),
        },
        async (ctx) => {
          const userId = await requireActor(ctx);
          return ctx.json(
            settingsResponse(
              ctx.context.baseURL,
              await runSettings(
                OrganizationSso.use((service) =>
                  service.get({ userId, ...ctx.query }),
                ),
              ),
            ),
          );
        },
      ),
      saveOrganizationSso: createAuthEndpoint(
        "/organization/sso",
        {
          method: "POST",
          body: Schema.toStandardSchemaV1(SsoSettingsBody),
        },
        async (ctx) => {
          const userId = await requireActor(ctx);
          return ctx.json(
            settingsResponse(
              ctx.context.baseURL,
              await runSettings(
                OrganizationSso.use((service) =>
                  service.save({ userId, settings: ctx.body }),
                ),
              ),
            ),
          );
        },
      ),
      verifyOrganizationSso: createAuthEndpoint(
        "/organization/sso/verify",
        {
          method: "POST",
          body: Schema.toStandardSchemaV1(OrganizationSsoQuery),
        },
        async (ctx) => {
          const userId = await requireActor(ctx);
          return ctx.json(
            settingsResponse(
              ctx.context.baseURL,
              await runSettings(
                OrganizationSso.use((service) =>
                  service.verify({ userId, ...ctx.body }),
                ),
              ),
            ),
          );
        },
      ),
      setOrganizationSsoEnabled: createAuthEndpoint(
        "/organization/sso/enabled",
        {
          method: "POST",
          body: Schema.toStandardSchemaV1(OrganizationSsoEnabled),
        },
        async (ctx) => {
          const userId = await requireActor(ctx);
          return ctx.json(
            settingsResponse(
              ctx.context.baseURL,
              await runSettings(
                OrganizationSso.use((service) =>
                  service.setEnabled({ userId, ...ctx.body }),
                ),
              ),
            ),
          );
        },
      ),
      deleteOrganizationSso: createAuthEndpoint(
        "/organization/sso/delete",
        {
          method: "POST",
          body: Schema.toStandardSchemaV1(OrganizationSsoQuery),
        },
        async (ctx) => {
          const userId = await requireActor(ctx);
          return ctx.json(
            await runSettings(
              OrganizationSso.use((service) =>
                service.remove({ userId, ...ctx.body }),
              ),
            ),
          );
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (context: { path?: string }) =>
            context.path === "/sign-in/sso" ||
            context.path === "/sso/callback/:providerId" ||
            context.path?.startsWith("/organization/sso") === true,
          handler: createAuthMiddleware(async (ctx) => {
            const origin = new URL(ctx.context.baseURL).origin;
            const allowedOrigins = new Set([
              origin,
              ...(await applicationOrigins(ctx.request)),
            ]);
            if (ctx.path.startsWith("/organization/sso")) {
              if (
                (ctx.method ?? "GET") !== "GET" &&
                !allowedOrigins.has(ctx.headers?.get("origin") ?? "")
              ) {
                throw new APIError("FORBIDDEN", {
                  message: "Invalid SSO request origin",
                });
              }
              return;
            }
            if (ctx.path === "/sign-in/sso") {
              const body = Schema.decodeUnknownOption(SignInSsoPayload, {
                onExcessProperty: "error",
              })(ctx.body);
              if (Option.isNone(body)) {
                throw new APIError("BAD_REQUEST", {
                  message: "Invalid SSO sign-in request",
                });
              }
              // Enforce this for native AND direct server calls. IdP discovery
              // origins are not application redirect targets, even though Better
              // Auth uses a shared trustedOrigins list for both purposes.
              for (const value of [
                body.value.callbackURL,
                body.value.errorCallbackURL,
              ]) {
                if (!value) continue;
                const target = Schema.decodeOption(
                  AuthRedirectURLFromString(origin),
                )(value);
                if (
                  Option.isNone(target) ||
                  !allowedOrigins.has(target.value.origin)
                ) {
                  throw new APIError("FORBIDDEN", {
                    message: "Invalid SSO callback URL",
                  });
                }
              }
              const requestOrigin = ctx.headers?.get("origin");
              if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
                throw new APIError("FORBIDDEN", {
                  message: "Invalid SSO request origin",
                });
              }
            }
            const providerId =
              ctx.path === "/sign-in/sso"
                ? ctx.body.providerId
                : ctx.params?.providerId;
            const row = await ctx.context.adapter.findOne({
              model: "ssoProvider",
              where: [{ field: "providerId", value: providerId }],
            });
            const binding = Schema.decodeUnknownOption(SsoBinding)(row);
            if (
              Option.isNone(binding) ||
              !binding.value.enabled ||
              !binding.value.domainVerified
            ) {
              throw new APIError("NOT_FOUND", {
                message: "SSO provider not found",
              });
            }
          }),
        },
      ],
    },
  };
};
