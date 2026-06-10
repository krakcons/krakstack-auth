import { and, eq, isNull, or } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { oauthClient } from "@/db/auth-schema";
import { DB } from "@/services/database";

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

const adminRow = (row: {
  id: string;
  clientId: string;
  name: string | null;
  icon: string | null;
  redirectUris: string[];
  scope: string[] | null;
  disabled: boolean | null;
  metadata: unknown;
}) => ({
  ...row,
  scope: row.scope?.join(" ") ?? null,
  metadata: decodeMetadataOrEmpty(row.metadata),
});

export class OAuthClients extends Context.Service<OAuthClients>()(
  "OAuthClients",
  {
    make: Effect.gen(function* () {
      const db = yield* DB;

      const list = Effect.fn("OAuthClients.list")(function* () {
        const rows = yield* db
          .select({
            id: oauthClient.id,
            clientId: oauthClient.clientId,
            name: oauthClient.name,
            icon: oauthClient.icon,
            redirectUris: oauthClient.redirectUris,
            scope: oauthClient.scopes,
            disabled: oauthClient.disabled,
            metadata: oauthClient.metadata,
          })
          .from(oauthClient);

        return rows.map(adminRow);
      });

      const create = Effect.fn("OAuthClients.create")(function* ({
        payload,
      }: {
        payload: CreateOAuthClientPayload;
      }) {
        const metadata = decodeMetadata(payload.metadata);
        const scope = scopesFromString(payload.scope);
        const [row] = yield* db
          .insert(oauthClient)
          .values({
            id: crypto.randomUUID(),
            clientId: `oauth_${crypto.randomUUID()}`,
            disabled: false,
            skipConsent: false,
            scopes: scope,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: payload.name || null,
            icon: payload.icon ?? null,
            redirectUris: Array.from(payload.redirectUris),
            tokenEndpointAuthMethod: "none",
            grantTypes: ["authorization_code", "refresh_token"],
            responseTypes: ["code"],
            public: true,
            type: "web",
            requirePKCE: true,
            metadata,
          })
          .returning({
            id: oauthClient.id,
            clientId: oauthClient.clientId,
            name: oauthClient.name,
            icon: oauthClient.icon,
            redirectUris: oauthClient.redirectUris,
            scope: oauthClient.scopes,
            disabled: oauthClient.disabled,
            metadata: oauthClient.metadata,
          });

        return adminRow(row);
      });

      const getPublicConfig = Effect.fn("OAuthClients.getPublicConfig")(
        function* ({ clientId }: { clientId: string }) {
          const [row] = yield* db
            .select({
              clientId: oauthClient.clientId,
              name: oauthClient.name,
              icon: oauthClient.icon,
              metadata: oauthClient.metadata,
            })
            .from(oauthClient)
            .where(
              and(
                eq(oauthClient.clientId, clientId),
                or(
                  eq(oauthClient.disabled, false),
                  isNull(oauthClient.disabled),
                ),
              ),
            )
            .limit(1);

          if (!row) return null;

          const metadata = decodeMetadataOrEmpty(row.metadata);
          return {
            clientId: row.clientId,
            name: row.name,
            logoUrl: row.icon,
            themeCss: sanitizeThemeCss(
              metadata.branding?.themeCss,
              row.clientId,
            ),
            authOptions: authOptions(metadata),
          };
        },
      );

      const update = Effect.fn("OAuthClients.update")(function* ({
        clientId,
        payload,
      }: {
        clientId: string;
        payload: UpdateOAuthClientPayload;
      }) {
        const metadata = decodeMetadata(payload.metadata);
        const [row] = yield* db
          .update(oauthClient)
          .set({
            name: payload.name || null,
            icon: payload.icon ?? null,
            scopes: payload.scope ? scopesFromString(payload.scope) : undefined,
            metadata,
            updatedAt: new Date(),
          })
          .where(eq(oauthClient.clientId, clientId))
          .returning({
            id: oauthClient.id,
            clientId: oauthClient.clientId,
            name: oauthClient.name,
            icon: oauthClient.icon,
            redirectUris: oauthClient.redirectUris,
            scope: oauthClient.scopes,
            disabled: oauthClient.disabled,
            metadata: oauthClient.metadata,
          });

        if (!row) return null;

        return adminRow(row);
      });

      return { list, create, getPublicConfig, update };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DB.layer),
  );
}
