import * as Layer from "effect/Layer";
import { describe, expect, it } from "@effect/vitest";
import { Events } from "@krak-stack/registry/events";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { createAuth } from "@/services/auth/config";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sqlTestLayer } from "@/services/database";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Native authentication activity",
  () => {
    it.effect(
      "uses verified sign-ins and session results, not caller-provided identity or project cookies",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const email = `${crypto.randomUUID()}@example.test`;
          const projectId = `activity-${crypto.randomUUID()}`;
          const oauthProjectId = `oauth-activity-${crypto.randomUUID()}`;
          const runAudit = Effect.runPromiseWith(
            yield* Effect.context<never>(),
          );
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            projectId,
            auditRun: (effect) =>
              runAudit(effect.pipe(Effect.provideService(Events, events))),
          });
          let userId = "";
          yield* Effect.gen(function* () {
            const otp = yield* Effect.promise(() =>
              auth.api.createVerificationOTP({
                body: { email, type: "sign-in" },
              }),
            );
            const response = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  "https://localhost:3001/api/auth/sign-in/email-otp",
                  {
                    method: "POST",
                    headers: {
                      origin: "https://localhost:3001",
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({ email, otp }),
                  },
                ),
              ),
            );
            expect(response.status).toBe(200);
            const body = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
            )(yield* Effect.promise(() => response.json()));
            userId = body.user.id;
            const cookie = response.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            for (let index = 0; index < 2; index++) {
              const session = yield* Effect.promise(() =>
                auth.handler(
                  new Request("https://localhost:3001/api/auth/get-session", {
                    headers: {
                      cookie: `${cookie}; krakstack-auth.project_context=forged-project`,
                    },
                  }),
                ),
              );
              expect(session.status).toBe(200);
            }
            const records =
              yield* sql`SELECT event_name, payload_json::text AS payload FROM events WHERE user_id = ${userId}`;
            expect(
              records.filter((row) => row.eventName === "auth.user_active"),
            ).toHaveLength(1);
            expect(
              records.filter((row) => row.eventName === "auth.user.registered"),
            ).toHaveLength(1);
            for (const record of records) {
              if (record.eventName === "auth.user_active")
                expect(record.payload).toContain(projectId);
              expect(record.payload).not.toContain("forged-project");
              expect(record.payload).not.toContain(otp);
            }
            yield* sql`INSERT INTO project (id, name) VALUES (${oauthProjectId}, ${oauthProjectId})`;
            yield* sql`INSERT INTO oauth_client (id, client_id, project_id, redirect_uris, scopes, skip_consent, token_endpoint_auth_method, grant_types, response_types)
              VALUES (${oauthProjectId}, ${oauthProjectId}, ${oauthProjectId}, ARRAY['https://client.example.test/callback'], ARRAY['openid'], true, 'none', ARRAY['authorization_code'], ARRAY['code'])`;
            const sharedAuth = createAuth({
              allowedHosts: ["localhost:3001"],
              auditRun: (effect) =>
                runAudit(effect.pipe(Effect.provideService(Events, events))),
            });
            const query = new URLSearchParams({
              client_id: oauthProjectId,
              redirect_uri: "https://client.example.test/callback",
              response_type: "code",
              scope: "openid",
              code_challenge: "a".repeat(43),
              code_challenge_method: "S256",
            });
            const authorization = yield* Effect.promise(() =>
              sharedAuth.handler(
                new Request(
                  `https://localhost:3001/api/auth/oauth2/authorize?${query}`,
                  { headers: { cookie } },
                ),
              ),
            );
            expect(authorization.status).toBe(302);
            expect(
              new URL(
                authorization.headers.get("location") ?? "https://invalid.test",
              ).searchParams.has("code"),
            ).toBe(true);
            const oauthActivity =
              yield* sql`SELECT payload_json::text AS payload FROM events WHERE user_id = ${userId} AND event_name = 'auth.user_active' AND payload_json::text LIKE ${`%${oauthProjectId}%`}`;
            expect(oauthActivity).toHaveLength(1);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                if (userId) {
                  yield* sql`DELETE FROM events WHERE user_id = ${userId}`;
                  yield* sql`DELETE FROM organization WHERE user_id = ${userId}`;
                  yield* sql`DELETE FROM "user" WHERE id = ${userId}`;
                  yield* sql`DELETE FROM verification WHERE value LIKE ${`%${userId}%`}`;
                }
                yield* sql`DELETE FROM oauth_client WHERE client_id = ${oauthProjectId}`;
                yield* sql`DELETE FROM project WHERE id = ${oauthProjectId}`;
                yield* sql`DELETE FROM verification WHERE identifier LIKE ${`%${email}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(
            testEventsLayer.pipe(Layer.provideMerge(sqlTestLayer)),
          ),
        ),
    );
  },
);
