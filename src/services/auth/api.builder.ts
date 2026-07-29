import { ExtraBadRequest } from "@krak-stack/auth/extra";
import { Effect, Option, Schema } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { eq } from "drizzle-orm";

import { FrontendApi } from "@/api";
import {
  LocaleContext,
  localize,
  type LocalizedInputType,
} from "@/lib/localization";
import { organization } from "@/db/schema";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import {
  apiKeyAllowedOrigins,
  requestMatchesAllowedOrigins,
} from "@/services/auth/api-key-referrers";
import { db } from "@/services/database";
import {
  EmailAddress,
  OrganizationMetadata,
  decodeOrganizationMetadata,
} from "@krak-stack/auth/schema";
import { Projects } from "@/services/projects";
import { uploadImageFromMultipart } from "@/services/s3/upload";

const authError = (fallback: string) => (error: unknown) =>
  new ExtraBadRequest({
    message: error instanceof Error ? error.message : fallback,
  });

const internalServerError = () => new HttpApiError.InternalServerError({});

const userRole = (value: unknown) => {
  if (typeof value !== "object" || value === null || !("role" in value)) {
    return undefined;
  }
  return Reflect.get(value, "role");
};

const hasAdminRole = (role: unknown) =>
  typeof role === "string" &&
  role.split(",").some((item) => item.trim() === "admin");

export const organizationPublicProfile = (
  record: {
    id: string;
    name: string;
    slug: string;
    metadata: unknown;
  },
  localeContext: LocalizedInputType,
) => {
  const metadata: OrganizationMetadata = decodeOrganizationMetadata(
    record.metadata,
  );

  const translation = metadata.translations.length
    ? localize(localeContext, {
        translations: Array.from(metadata.translations),
      })
    : null;
  const emails = Array.from(metadata.emails ?? []);
  if (
    translation?.contactEmail &&
    Option.isSome(
      Schema.decodeUnknownOption(EmailAddress)(translation.contactEmail),
    ) &&
    !emails.some((email) => email.email === translation.contactEmail)
  ) {
    emails.unshift({
      email: translation.contactEmail,
      translations: [
        {
          locale: translation.locale,
          label: translation.locale === "fr" ? "Courriel" : "Email",
        },
      ],
    });
  }
  const addresses = Array.from(metadata.addresses ?? []).map(
    (postalAddress) => ({
      ...postalAddress,
      formatted: [
        postalAddress.streetAddress,
        [postalAddress.locality, postalAddress.region, postalAddress.postalCode]
          .filter(Boolean)
          .join(" "),
        postalAddress.country,
      ]
        .filter(Boolean)
        .join(", "),
    }),
  );
  if (!addresses.length && translation?.location) {
    addresses.push({
      formatted: translation.location,
      translations: [
        {
          locale: translation.locale,
          label: translation.locale === "fr" ? "Adresse" : "Address",
        },
      ],
    });
  }
  const localizedEmail = emails.find(
    (email) =>
      localize(localeContext, {
        ...email,
        translations: Array.from(email.translations),
      }).locale === localeContext.locale,
  );
  const contactEmail =
    localizedEmail?.email ??
    emails[0]?.email ??
    translation?.contactEmail ??
    null;

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    displayName: translation?.name ?? record.name,
    contactEmail,
    emails,
    phones: Array.from(metadata.phones ?? []),
    websites: Array.from(metadata.websites ?? []),
    socials: Array.from(metadata.socials ?? []),
    addresses,
    logo: translation?.logo ?? null,
    icon: translation?.icon ?? null,
  };
};

const requestAuth = (
  request: HttpServerRequest.HttpServerRequest,
  fallback: string,
) =>
  BetterAuthRequest.pipe(
    Effect.provide(BetterAuthRequest.make(request)),
    Effect.mapError(authError(fallback)),
  );

const requestAuthSession = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const client = yield* BetterAuthRequest.pipe(
      Effect.provide(BetterAuthRequest.make(request)),
      Effect.mapError(internalServerError),
    );

    return yield* Effect.tryPromise({
      try: () => client.api.getSession({ headers: client.headers }),
      catch: internalServerError,
    });
  });

const requireMutableUserSession = (
  request: HttpServerRequest.HttpServerRequest,
) =>
  Effect.gen(function* () {
    const session = yield* requestAuthSession(request);

    if (!session) return yield* new HttpApiError.Unauthorized({});
    if (session.session.impersonatedByOrganizationId) {
      return yield* new HttpApiError.Forbidden({});
    }

    return session;
  });

export const authApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "authExtra",
  (handlers) =>
    handlers
      .handle("getProjectPublicConfig", ({ query }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          return yield* projects
            .getPublicConfig({
              projectId: query.projectId,
              clientId: query.clientId,
              host: query.host,
              rootHost: query.rootHost,
            })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("getOrganizationPublicProfile", ({ query }) =>
        Effect.gen(function* () {
          const localeContext = yield* LocaleContext;
          const [record] = yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  id: organization.id,
                  name: organization.name,
                  slug: organization.slug,
                  metadata: organization.metadata,
                })
                .from(organization)
                .where(eq(organization.id, query.organizationId))
                .limit(1),
            catch: internalServerError,
          });

          if (!record) return yield* new HttpApiError.NotFound({});

          return organizationPublicProfile(record, localeContext);
        }),
      )
      .handle("setPassword", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireMutableUserSession(request);
          const client = yield* requestAuth(request, "Could not set password");
          yield* Effect.tryPromise({
            try: () =>
              client.api.setPassword({
                body: { newPassword: payload.newPassword },
                headers: client.headers,
              }),
            catch: authError("Could not set password"),
          });

          return { ok: true };
        }),
      )
      .handle("verifyPassword", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireMutableUserSession(request);
          const client = yield* requestAuth(
            request,
            "Could not verify password",
          );
          yield* Effect.tryPromise({
            try: () =>
              client.api.verifyPassword({
                body: { password: payload.password },
                headers: client.headers,
              }),
            catch: authError("Could not verify password"),
          });

          return { ok: true };
        }),
      )
      .handle("createApiKey", ({ payload, request }) =>
        Effect.gen(function* () {
          const client = yield* requestAuth(
            request,
            "Could not create API key",
          );
          const session = yield* requireMutableUserSession(request);

          if (
            payload.configId === "service" &&
            !hasAdminRole(userRole(session.user))
          ) {
            return yield* new HttpApiError.Forbidden({});
          }

          const permissions = payload.permissions
            ? Object.fromEntries(
                Object.entries(payload.permissions).map(
                  ([resource, actions]) => [resource, Array.from(actions)],
                ),
              )
            : undefined;
          const result = yield* Effect.tryPromise({
            try: () =>
              client.api.createApiKey({
                body: {
                  configId: payload.configId,
                  userId: session.user.id,
                  ...(payload.name ? { name: payload.name } : {}),
                  ...(payload.organizationId
                    ? { organizationId: payload.organizationId }
                    : {}),
                  ...(permissions ? { permissions } : {}),
                  ...(payload.referrers
                    ? {
                        metadata: {
                          allowedOrigins: Array.from(payload.referrers),
                        },
                      }
                    : {}),
                },
              }),
            catch: authError("Could not create API key"),
          });

          return { id: result.id, key: result.key };
        }),
      )
      .handle("verifyApiKey", ({ payload, request }) =>
        Effect.gen(function* () {
          const client = yield* requestAuth(
            request,
            "Could not verify API key",
          );
          const permissions = payload.permissions
            ? Object.fromEntries(
                Object.entries(payload.permissions).map(
                  ([resource, actions]) => [resource, Array.from(actions)],
                ),
              )
            : undefined;
          const body = {
            key: payload.key,
            ...(payload.configId ? { configId: payload.configId } : {}),
            ...(permissions ? { permissions } : {}),
          };

          const result = yield* Effect.tryPromise({
            try: () =>
              client.api.verifyApiKey({ body, headers: client.headers }),
            catch: authError("Could not verify API key"),
          });

          if (result.valid && result.key) {
            const allowedOrigins = apiKeyAllowedOrigins(result.key.metadata);
            const origin = Option.getOrUndefined(
              Headers.get(request.headers, "origin"),
            );
            const referrer = Option.getOrUndefined(
              Headers.get(request.headers, "referer"),
            );
            if (
              !requestMatchesAllowedOrigins(origin, referrer, allowedOrigins)
            ) {
              return {
                valid: false,
                error: {
                  code: "INVALID_REFERRER",
                  message: "The API key is not allowed from this referrer.",
                },
                key: null,
              };
            }
          }

          return result;
        }).pipe(
          Effect.map((result) => ({
            valid: result.valid,
            error: result.error
              ? {
                  code: result.error.code,
                  message: String(result.error.message ?? result.error.code),
                }
              : null,
            key: result.key
              ? {
                  id: result.key.id,
                  configId: result.key.configId,
                  name: result.key.name ?? null,
                  start: result.key.start ?? null,
                  prefix: result.key.prefix ?? null,
                  referenceId: result.key.referenceId,
                  enabled: result.key.enabled ?? null,
                  expiresAt: result.key.expiresAt ?? null,
                  createdAt: result.key.createdAt,
                  updatedAt: result.key.updatedAt,
                  permissions: result.key.permissions ?? null,
                  metadata: result.key.metadata ?? null,
                }
              : null,
          })),
        ),
      )
      .handle("uploadUserImage", ({ payload, request }) =>
        Effect.gen(function* () {
          const session = yield* requireMutableUserSession(request);

          const url = yield* uploadImageFromMultipart({
            payload,
            prefix: `logos/uploads/${session.user.id}`,
            fallbackFileName: "image",
            badRequest: (message) => new ExtraBadRequest({ message }),
            internalServerError,
          });

          return { url };
        }),
      ),
);
