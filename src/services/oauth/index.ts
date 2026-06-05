import { and, eq, isNull, or } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { oauthClient } from "@/db/auth-schema";
import { DB } from "@/services/database";

import { OAuthClientMetadata, type UpdateOAuthClientPayload } from "./schema";
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

        return rows.map((row) => ({
          ...row,
          scope: row.scope?.join(" ") ?? null,
          metadata: decodeMetadataOrEmpty(row.metadata),
        }));
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
            disabled: oauthClient.disabled,
            metadata: oauthClient.metadata,
          });

        if (!row) return null;

        return {
          ...row,
          scope: null,
          metadata: decodeMetadataOrEmpty(row.metadata),
        };
      });

      return { list, getPublicConfig, update };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DB.layer),
  );
}
