import { Context, Effect, Layer, Schema } from "effect";
import type { Headers } from "effect/unstable/http/Headers";
import { eq } from "drizzle-orm";

import { oauthClient } from "@/db/auth-schema";
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
  Schema.decodeUnknownSync(OAuthClientMetadata)(value ?? emptyMetadata);

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

const metadataFromClient = (client: object) => {
  const metadata = Reflect.get(client, "metadata");
  if (metadata !== undefined && metadata !== null) {
    return decodeMetadataOrEmpty(metadata);
  }

  return decodeMetadataOrEmpty({
    branding: Reflect.get(client, "branding"),
    authOptions: Reflect.get(client, "authOptions"),
  });
};

const adminRow = (client: {
  client_id: string;
  client_name?: string;
  logo_uri?: string;
  redirect_uris?: ReadonlyArray<string>;
  scope?: string;
  disabled?: boolean;
}) => ({
  id: client.client_id,
  clientId: client.client_id,
  name: client.client_name ?? null,
  icon: client.logo_uri ?? null,
  redirectUris: Array.from(client.redirect_uris ?? []),
  scope: client.scope ?? null,
  disabled: client.disabled ?? null,
  metadata: metadataFromClient(client),
});

const createdRow = (
  client: Parameters<typeof adminRow>[0],
  clientSecret: string,
) => ({
  ...adminRow(client),
  clientSecret,
});

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

        return createdRow(client, client.client_secret ?? "");
      });

      const getPublicConfig = Effect.fn("OAuthClients.getPublicConfig")(
        function* ({ clientId }: { clientId: string }) {
          const [client] = yield* db
            .select()
            .from(oauthClient)
            .where(eq(oauthClient.clientId, clientId))
            .limit(1);

          if (!client || client.disabled) return null;

          const metadata = metadataFromClient(client);

          return {
            clientId: client.clientId,
            name: client.name ?? null,
            logoUrl: client.icon ?? null,
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
