import {
  Config,
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { discoverOIDCConfig } from "@better-auth/sso";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { resolveTxt } from "node:dns/promises";
import { EmailAddress } from "@krak-stack/auth/schema";
import {
  OrganizationSsoConnection,
  type OrganizationSsoSettings,
  type SsoDiscoveryQuery,
} from "@krak-stack/auth/auth";
import {
  ApprovedSsoUrl,
  SsoOidcJson,
  SsoSettingsWrite,
  SsoStoredConnection,
} from "./schema";

export class SsoSettingsError extends Data.TaggedError("SsoSettingsError")<{
  readonly status: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";
}> {}
const invalid = () => new SsoSettingsError({ status: "BAD_REQUEST" });

export const encryptSsoConfig = Effect.fn("Sso.encryptConfig")(function* (
  value: string,
) {
  const key = yield* Config.Redacted("BETTER_AUTH_SECRET");
  return yield* Effect.tryPromise({
    try: () => symmetricEncrypt({ key: Redacted.value(key), data: value }),
    catch: invalid,
  });
});
export const decryptSsoConfig = Effect.fn("Sso.decryptConfig")(function* (
  value: string,
) {
  const key = yield* Config.Redacted("BETTER_AUTH_SECRET");
  return yield* Effect.tryPromise({
    try: () => symmetricDecrypt({ key: Redacted.value(key), data: value }),
    catch: invalid,
  });
});

export class SsoDns extends Context.Service<
  SsoDns,
  {
    readonly lookup: (
      name: string,
    ) => Effect.Effect<ReadonlyArray<string>, SsoSettingsError>;
  }
>()("auth/SsoDns") {
  static readonly layer = Layer.succeed(this, {
    lookup: (name) =>
      Effect.tryPromise({
        try: () =>
          resolveTxt(name).then((records) =>
            records.map((record) => record.join("")),
          ),
        catch: invalid,
      }),
  });
}

export const verificationName = (providerId: string, domain: string) =>
  `_krakstack-sso-${providerId}.${domain}`;

export class OrganizationSso extends Context.Service<OrganizationSso>()(
  "auth/OrganizationSso",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const dns = yield* SsoDns;
      const find = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: SsoStoredConnection,
        execute: (id) =>
          sql`SELECT * FROM sso_provider WHERE organization_id = ${id}`,
      });
      const requireAdmin = Effect.fn("OrganizationSso.requireAdmin")(
        function* (actor: { userId: string; organizationId: string }) {
          const members = yield* SqlSchema.findAll({
            Request: Schema.Void,
            Result: Schema.Struct({ role: Schema.String }).annotate({
              identifier: "SsoAdminMembership",
            }),
            execute: () =>
              sql`SELECT role FROM member WHERE organization_id = ${actor.organizationId} AND user_id = ${actor.userId} FOR SHARE`,
          })();
          if (
            !members.some((member) =>
              member.role
                .split(",")
                .some((role) => role === "owner" || role === "admin"),
            )
          ) {
            return yield* new SsoSettingsError({ status: "FORBIDDEN" });
          }
        },
      );
      const view = Effect.fn("OrganizationSso.view")(function* (
        row: typeof SsoStoredConnection.Type,
      ) {
        const config = yield* decryptSsoConfig(row.oidcConfig).pipe(
          Effect.flatMap(Schema.decodeEffect(SsoOidcJson)),
        );
        return yield* Schema.decodeEffect(OrganizationSsoConnection)({
          organizationId: row.organizationId,
          providerId: row.providerId,
          issuer: row.issuer,
          domain: row.domain,
          clientId: config.clientId,
          enabled: row.enabled,
          domainVerified: row.domainVerified,
          verificationName: verificationName(row.providerId, row.domain),
          verificationToken: row.verificationToken,
        });
      });
      const get = Effect.fn("OrganizationSso.get")(function* (actor: {
        userId: string;
        organizationId: string;
      }) {
        yield* requireAdmin(actor);
        const row = yield* find(actor.organizationId);
        return Option.isSome(row) ? yield* view(row.value) : null;
      });
      const save = Effect.fn("OrganizationSso.save")(function* ({
        userId,
        settings,
      }: {
        userId: string;
        settings: typeof OrganizationSsoSettings.Type;
      }) {
        const payload = yield* Schema.decodeEffect(SsoSettingsWrite)(
          settings,
        ).pipe(Effect.mapError(invalid));
        const actor = { userId, organizationId: payload.organizationId };
        yield* requireAdmin(actor);
        const current = yield* find(payload.organizationId);
        if (
          Option.isSome(current) &&
          (current.value.issuer !== payload.issuer ||
            current.value.domain !== payload.domain)
        ) {
          return yield* new SsoSettingsError({ status: "CONFLICT" });
        }
        const oldConfig = Option.isSome(current)
          ? yield* decryptSsoConfig(current.value.oidcConfig).pipe(
              Effect.flatMap(Schema.decodeEffect(SsoOidcJson)),
            )
          : null;
        const clientSecret = payload.clientSecret ?? oldConfig?.clientSecret;
        if (!clientSecret) return yield* invalid();
        // The library validates discovery issuer, endpoints and redirect/SSRF rules.
        const discovered = yield* Effect.tryPromise({
          try: () =>
            discoverOIDCConfig({
              issuer: payload.issuer,
              isTrustedOrigin: (url) =>
                Option.isSome(Schema.decodeOption(ApprovedSsoUrl)(url)),
            }),
          catch: invalid,
        });
        const config = yield* Schema.encodeEffect(SsoOidcJson)({
          ...discovered,
          issuer: payload.issuer,
          clientId: payload.clientId,
          clientSecret,
          discoveryEndpoint: `${payload.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
          pkce: true,
          scopes: ["openid", "profile", "email"],
          tokenEndpointAuthentication:
            discovered.tokenEndpointAuthentication === "client_secret_post"
              ? "client_secret_post"
              : "client_secret_basic",
        }).pipe(Effect.mapError(invalid));
        const encrypted = yield* encryptSsoConfig(config);
        return yield* Effect.gen(function* () {
          yield* requireAdmin(actor);
          yield* sql`SELECT id FROM organization WHERE id = ${payload.organizationId} FOR UPDATE`;
          const latest = yield* find(payload.organizationId);
          // A concurrent removal/reconfiguration must not overwrite another connection.
          if (
            Option.isSome(latest) !== Option.isSome(current) ||
            (Option.isSome(latest) &&
              Option.isSome(current) &&
              (latest.value.id !== current.value.id ||
                latest.value.oidcConfig !== current.value.oidcConfig))
          ) {
            return yield* new SsoSettingsError({ status: "CONFLICT" });
          }
          if (Option.isSome(latest)) {
            yield* sql`UPDATE sso_provider SET oidc_config = ${encrypted}, enabled = false, updated_at = now() WHERE id = ${latest.value.id}`;
          } else {
            const id = crypto.randomUUID();
            yield* sql`INSERT INTO sso_provider (id, provider_id, issuer, oidc_config, user_id, organization_id, domain, verification_token)
            VALUES (${id}, ${id}, ${payload.issuer}, ${encrypted}, ${userId}, ${payload.organizationId}, ${payload.domain}, ${crypto.randomUUID()})`;
          }
          return yield* get(actor);
        }).pipe(sql.withTransaction);
      });
      const verify = Effect.fn("OrganizationSso.verify")(function* (actor: {
        userId: string;
        organizationId: string;
      }) {
        yield* requireAdmin(actor);
        const row = yield* find(actor.organizationId);
        if (Option.isNone(row))
          return yield* new SsoSettingsError({ status: "NOT_FOUND" });
        const records = yield* dns.lookup(
          verificationName(row.value.providerId, row.value.domain),
        );
        if (
          !records.some(
            (record) => record.trim() === row.value.verificationToken,
          )
        )
          return yield* invalid();
        return yield* Effect.gen(function* () {
          yield* requireAdmin(actor);
          const updated =
            yield* sql`UPDATE sso_provider SET domain_verified = true, updated_at = now()
          WHERE id = ${row.value.id} AND verification_token = ${row.value.verificationToken} RETURNING id`;
          if (!updated.length)
            return yield* new SsoSettingsError({ status: "CONFLICT" });
          return yield* get(actor);
        }).pipe(sql.withTransaction);
      });
      const setEnabled = Effect.fn("OrganizationSso.setEnabled")(
        function* (actor: {
          userId: string;
          organizationId: string;
          enabled: boolean;
        }) {
          yield* requireAdmin(actor);
          yield* sql`SELECT id FROM sso_provider WHERE organization_id = ${actor.organizationId} FOR UPDATE`;
          const row = yield* find(actor.organizationId);
          if (Option.isNone(row))
            return yield* new SsoSettingsError({ status: "NOT_FOUND" });
          if (actor.enabled && !row.value.domainVerified)
            return yield* invalid();
          if (actor.enabled) {
            const conflicts =
              yield* sql`SELECT id FROM sso_provider WHERE domain = ${row.value.domain} AND enabled = true AND domain_verified = true AND id <> ${row.value.id}`;
            if (conflicts.length)
              return yield* new SsoSettingsError({ status: "CONFLICT" });
          }
          yield* sql`UPDATE sso_provider SET enabled = ${actor.enabled}, updated_at = now() WHERE id = ${row.value.id} AND (domain_verified = true OR ${!actor.enabled})`;
          return yield* get(actor);
        },
        sql.withTransaction,
      );
      const remove = Effect.fn("OrganizationSso.remove")(function* (actor: {
        userId: string;
        organizationId: string;
      }) {
        yield* requireAdmin(actor);
        yield* sql`SELECT id FROM sso_provider WHERE organization_id = ${actor.organizationId} FOR UPDATE`;
        const row = yield* find(actor.organizationId);
        if (Option.isSome(row)) {
          yield* sql`DELETE FROM account WHERE provider_id = ${row.value.providerId}`;
          yield* sql`DELETE FROM sso_provider WHERE id = ${row.value.id}`;
        }
        return { success: true };
      }, sql.withTransaction);
      const discover = Effect.fn("OrganizationSso.discover")(function* (
        query: typeof SsoDiscoveryQuery.Type,
      ) {
        const email = query.email
          ? Schema.decodeOption(EmailAddress)(query.email.toLowerCase())
          : Option.none();
        if (!query.organizationSlug && Option.isNone(email)) return null;
        const domain = Option.isSome(email) ? email.value.split("@")[1] : "";
        const rows = yield* SqlSchema.findAll({
          Request: Schema.Void,
          Result: Schema.Struct({ providerId: Schema.NonEmptyString }).annotate(
            { identifier: "PublicOrganizationSso" },
          ),
          execute: () =>
            query.organizationSlug
              ? sql`SELECT s.provider_id FROM sso_provider s JOIN organization o ON o.id = s.organization_id WHERE o.slug = ${query.organizationSlug} AND s.enabled = true AND s.domain_verified = true LIMIT 2`
              : sql`SELECT provider_id FROM sso_provider WHERE domain = ${domain} AND enabled = true AND domain_verified = true LIMIT 2`,
        })();
        return rows.length === 1 ? (rows[0] ?? null) : null;
      });
      return { get, save, verify, setEnabled, remove, discover };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(SsoDns.layer),
  );
}
