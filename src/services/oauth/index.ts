import { Context, Effect, Layer, Schema } from "effect";
import type { Headers } from "effect/unstable/http/Headers";
import { eq } from "drizzle-orm";

import { oauthClient } from "@/db/auth-schema";
import { normalizeOAuthClientDomains } from "@/lib/domain-utils";
import { DB } from "@/services/database";
import { auth } from "@/services/auth/config";

import {
  OAuthClientMetadata,
  type CreateOAuthClientPayload,
  type UpdateOAuthClientPayload,
} from "./schema";
import { sanitizeThemeCss } from "./theme";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const emptyMetadata: OAuthClientMetadata = {};

const decodeMetadata = (value: unknown) =>
  (() => {
    const metadata = Schema.decodeUnknownSync(OAuthClientMetadata)(
      value ?? emptyMetadata,
    );
    const domains = normalizeOAuthClientDomains(metadata.domains ?? []);
    return { ...metadata, ...(domains.length ? { domains } : {}) };
  })();

const decodeMetadataOrEmpty = (value: unknown) => {
  try {
    return decodeMetadata(value);
  } catch {
    return emptyMetadata;
  }
};

const authOptions = (metadata: OAuthClientMetadata) => ({
  emailPassword: metadata.authOptions?.emailPassword ?? true,
  google: googleConfigured && (metadata.authOptions?.google ?? true),
  signUp: metadata.authOptions?.signUp ?? true,
  signUpName: metadata.authOptions?.signUpName ?? true,
});

const scopesFromString = (value: string | undefined) =>
  value
    ?.split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length
    ? value
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : ["openid", "profile", "email"];

const domainsFromMetadata = (metadata: OAuthClientMetadata) =>
  normalizeOAuthClientDomains(metadata.domains ?? []);

const RawOAuthClient = Schema.Struct({
  client_id: Schema.optional(Schema.String),
  clientId: Schema.optional(Schema.String),
  client_secret: Schema.optional(Schema.String),
  clientSecret: Schema.optional(Schema.String),
  client_name: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  logo_uri: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.String),
  redirect_uris: Schema.optional(Schema.Array(Schema.String)),
  redirectUris: Schema.optional(Schema.Array(Schema.String)),
  scope: Schema.optional(Schema.String),
  scopes: Schema.optional(Schema.Array(Schema.String)),
  disabled: Schema.optional(Schema.Boolean),
  metadata: Schema.optional(Schema.NullOr(Schema.Unknown)),
  domains: Schema.optional(Schema.Array(Schema.String)),
  branding: Schema.optional(Schema.Unknown),
  authOptions: Schema.optional(Schema.Unknown),
});

const decodeRawOAuthClient = Schema.decodeUnknownSync(RawOAuthClient);

const metadataFromRawOAuthClient = (client: typeof RawOAuthClient.Type) =>
  client.metadata !== undefined && client.metadata !== null
    ? decodeMetadataOrEmpty(client.metadata)
    : decodeMetadataOrEmpty({
        domains: client.domains,
        branding: client.branding,
        authOptions: client.authOptions,
      });

const adminRow = (client: object) => {
  const decoded = decodeRawOAuthClient(client);
  const clientId = decoded.client_id ?? decoded.clientId;
  if (!clientId) throw new Error("OAuth client response is missing client ID");

  const metadata = metadataFromRawOAuthClient(decoded);

  return {
    id: clientId,
    clientId,
    name: decoded.client_name ?? decoded.name ?? null,
    icon: decoded.logo_uri ?? decoded.icon ?? null,
    redirectUris: Array.from(
      decoded.redirect_uris ?? decoded.redirectUris ?? [],
    ),
    domains: domainsFromMetadata(metadata),
    scope: decoded.scope ?? decoded.scopes?.join(" ") ?? null,
    disabled: decoded.disabled ?? null,
    metadata,
  };
};

const createdRow = (client: object) => {
  const decoded = decodeRawOAuthClient(client);

  return {
    ...adminRow(client),
    clientSecret: decoded.client_secret ?? decoded.clientSecret ?? "",
  };
};

export class OAuthClients extends Context.Service<OAuthClients>()(
  "OAuthClients",
  {
    make: Effect.gen(function* () {
      const db = yield* DB;

      const list = Effect.fn("OAuthClients.list")(function* ({
        headers,
      }: {
        headers: Headers;
      }) {
        const clients = yield* Effect.promise(() =>
          auth.api.getOAuthClients({ headers }),
        );

        return (clients ?? []).map(adminRow);
      });

      const create = Effect.fn("OAuthClients.create")(function* ({
        headers,
        payload,
      }: {
        headers: Headers;
        payload: CreateOAuthClientPayload;
      }) {
        const metadata = decodeMetadata(payload.metadata);
        const client = yield* Effect.promise(() =>
          auth.api.adminCreateOAuthClient({
            headers,
            body: {
              redirect_uris: Array.from(payload.redirectUris),
              scope: scopesFromString(payload.scope).join(" "),
              client_name: payload.name || undefined,
              logo_uri: payload.icon ?? undefined,
              token_endpoint_auth_method: "client_secret_basic",
              grant_types: ["authorization_code", "refresh_token"],
              response_types: ["code"],
              type: "web",
              require_pkce: true,
              metadata,
            },
          }),
        );

        return createdRow(client);
      });

      const getPublicConfig = Effect.fn("OAuthClients.getPublicConfig")(
        function* ({ clientId }: { clientId: string }) {
          const [client] = yield* db
            .select()
            .from(oauthClient)
            .where(eq(oauthClient.clientId, clientId))
            .limit(1);

          if (!client || client.disabled) return null;

          const metadata = metadataFromRawOAuthClient(
            decodeRawOAuthClient(client),
          );
          const domains = domainsFromMetadata(metadata);

          return {
            clientId: client.clientId,
            name: client.name ?? null,
            logoUrl: client.icon ?? null,
            domains,
            themeCss: sanitizeThemeCss(metadata.branding?.themeCss, clientId),
            authOptions: authOptions(metadata),
          };
        },
      );

      const update = Effect.fn("OAuthClients.update")(function* ({
        clientId,
        headers,
        payload,
      }: {
        clientId: string;
        headers: Headers;
        payload: UpdateOAuthClientPayload;
      }) {
        const metadata = decodeMetadata(payload.metadata);
        const client = yield* Effect.promise(() =>
          auth.api.adminUpdateOAuthClient({
            headers,
            body: {
              client_id: clientId,
              update: {
                client_name: payload.name || undefined,
                logo_uri: payload.icon ?? undefined,
                redirect_uris: payload.redirectUris
                  ? Array.from(payload.redirectUris)
                  : undefined,
                scope: payload.scope
                  ? scopesFromString(payload.scope).join(" ")
                  : undefined,
                metadata,
              },
            },
          }),
        );

        return adminRow(client);
      });

      const _delete = Effect.fn("OAuthClients.delete")(function* ({
        clientId,
        headers,
      }: {
        clientId: string;
        headers: Headers;
      }) {
        const client = yield* Effect.promise(() =>
          auth.api.getOAuthClient({
            headers,
            query: { client_id: clientId },
          }),
        );

        yield* Effect.promise(() =>
          auth.api.deleteOAuthClient({
            headers,
            body: { client_id: clientId },
          }),
        );

        return adminRow(client);
      });

      return { list, create, getPublicConfig, update, delete: _delete };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DB.layer),
  );
}
