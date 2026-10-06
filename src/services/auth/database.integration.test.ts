import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { UserMetadata } from "@krak-stack/auth/schema";

import { ApiKeyRow, UserRow } from "@/db/schema";
import { sqlTestLayer } from "@/services/database";
import { createAuth } from "./config";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Better Auth native PostgreSQL adapter",
  () => {
    it.effect(
      "shares snake-case records with Effect SQL and preserves plugin values",
      () => {
        const userId = `sql-auth-${crypto.randomUUID()}`;
        return Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const auth = createAuth({ allowedHosts: ["localhost:3001"] });
          const context = yield* Effect.promise(() => auth.$context);
          const now = new Date();
          const metadata = Schema.decodeUnknownSync(UserMetadata)({
            emails: [],
            phones: [],
          });
          yield* Effect.promise(() =>
            context.adapter.create({
              model: "user",
              data: {
                id: userId,
                name: "SQL Adapter",
                email: `${userId}@example.com`,
                emailVerified: true,
                role: "admin",
                metadata,
                createdAt: now,
                updatedAt: now,
              },
              forceAllowId: true,
            }),
          );
          const stored = yield* SqlSchema.findOne({
            Request: Schema.String,
            Result: UserRow,
            execute: (id) => sql`SELECT * FROM "user" WHERE id = ${id}`,
          })(userId);
          expect(stored.metadata).toEqual(metadata);
          expect(stored.emailVerified).toBe(true);
          expect(stored.createdAt).toBeInstanceOf(Date);
          expect(stored.createdAt.getTime()).toBe(now.getTime());

          yield* Effect.promise(() =>
            context.adapter.create({
              model: "oauthClient",
              data: {
                id: userId,
                clientId: userId,
                userId,
                name: "SQL OAuth",
                redirectUris: ["https://example.com/callback"],
                scopes: ["openid", "profile"],
                requirePKCE: true,
                metadata: {},
                createdAt: now,
                updatedAt: now,
              },
              forceAllowId: true,
            }),
          );
          const client = yield* SqlSchema.findOne({
            Request: Schema.String,
            Result: Schema.Struct({
              requirePkce: Schema.Boolean,
              redirectUris: Schema.Array(Schema.String),
              scopes: Schema.Array(Schema.String),
              metadata: Schema.Json,
            }).annotate({ identifier: "NativeOAuthClientRow" }),
            execute: (id) =>
              sql`SELECT require_pkce, redirect_uris, scopes, metadata FROM oauth_client WHERE client_id = ${id}`,
          })(userId);
          expect(client.requirePkce).toBe(true);
          expect(client.redirectUris).toEqual(["https://example.com/callback"]);
          expect(client.scopes).toEqual(["openid", "profile"]);
          expect(client.metadata).toEqual({});

          yield* Effect.promise(() =>
            context.adapter.create({
              model: "session",
              data: {
                id: userId,
                token: userId,
                userId,
                expiresAt: new Date(Date.now() + 60_000),
                createdAt: now,
                updatedAt: now,
                impersonatedByOrganizationId: "organization-test",
              },
              forceAllowId: true,
            }),
          );
          const session = yield* Effect.promise(() =>
            context.internalAdapter.findSession(userId),
          );
          expect(session?.session.userId).toBe(userId);
          expect(session?.session.impersonatedByOrganizationId).toBe(
            "organization-test",
          );
          yield* sql`UPDATE "user" SET metadata = ${Schema.encodeSync(Schema.fromJsonString(Schema.Json))({ emails: [{ email: "legacy@example.com", label: "Work" }] })}::jsonb WHERE id = ${userId}`;
          const createdSession = yield* Schema.decodeUnknownEffect(
            Schema.Struct({ activeOrganizationId: Schema.String }).annotate({
              identifier: "PersonalOrganizationSessionRow",
            }),
          )(
            yield* Effect.promise(() =>
              context.internalAdapter.createSession(userId),
            ),
          );
          expect(createdSession?.activeOrganizationId).toBeTruthy();
          const personalOrganization = yield* SqlSchema.findOne({
            Request: Schema.String,
            Result: Schema.Struct({
              id: Schema.String,
              userId: Schema.String,
            }).annotate({ identifier: "PersonalOrganizationSqlRow" }),
            execute: (id) =>
              sql`SELECT id, user_id FROM organization WHERE user_id = ${id}`,
          })(userId);
          expect(createdSession?.activeOrganizationId).toBe(
            personalOrganization.id,
          );

          const createdKey = yield* Effect.promise(() =>
            auth.api.createApiKey({
              body: {
                configId: "service",
                userId,
                name: "SQL service key",
                metadata: { allowedOrigins: ["https://example.com"] },
                permissions: { [userId]: ["auth:proxy"] },
              },
            }),
          );
          const verification = yield* Effect.promise(() =>
            auth.api.verifyApiKey({
              body: { configId: "service", key: createdKey.key },
            }),
          );
          expect(verification.valid).toBe(true);
          expect(verification.key?.metadata).toEqual({
            allowedOrigins: ["https://example.com"],
          });
          expect(verification.key?.permissions).toEqual({
            [userId]: ["auth:proxy"],
          });
          const storedKey = yield* SqlSchema.findOne({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) => sql`SELECT * FROM apikey WHERE id = ${id}`,
          })(createdKey.id);
          expect(storedKey.referenceId).toBe(userId);
          expect(storedKey.configId).toBe("service");
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              const sql = yield* SqlClient.SqlClient;
              yield* sql`DELETE FROM apikey WHERE reference_id = ${userId}`;
              yield* sql`DELETE FROM "user" WHERE id = ${userId}`;
            }).pipe(Effect.orDie),
          ),
          Effect.provide(sqlTestLayer),
        );
      },
    );
  },
);
