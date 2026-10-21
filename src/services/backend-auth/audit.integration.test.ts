import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Events } from "@krak-stack/registry/events";
import { Effect, Layer, Schema } from "effect";
import { Etag, FetchHttpClient, HttpRouter } from "effect/http";
import {
  Credentials,
  apiTokenCredentials,
} from "@distilled.cloud/cloudflare/Credentials";
import { HttpApiBuilder } from "effect/http-api";
import { SqlClient } from "effect/sql";
import { testEventsLayer } from "@/services/audit/test-layer";
import { createAuth } from "@/services/auth/config";
import { serviceApiKeyMiddlewareLayer } from "@/services/auth/middleware.server";
import { sqlTestLayer } from "@/services/database";
import { Domains } from "@/services/domains";
import { BackendAuth } from ".";
import { BackendAuthApi } from "./api.group";
import { backendAuthApiHandler } from "./api.builder";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "backend domain audit attribution",
  () => {
    it.effect(
      "audits domain creation/deletion using the verified service key, not caller identity headers",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const id = crypto.randomUUID();
          const hostname = `audit-${id}.example.test`;
          const base = new URL(
            process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
          ).origin;
          const auth = createAuth({
            allowedHosts: [new URL(base).host],
            auditRun: async () => {},
          });
          yield* sql`INSERT INTO "user" (id, name, email, email_verified, role) VALUES (${id}, 'Service audit test', ${`${id}@example.test`}, true, 'admin')`;
          const web = HttpRouter.toWebHandler(
            HttpApiBuilder.layer(BackendAuthApi).pipe(
              Layer.provide(backendAuthApiHandler),
              Layer.provide(serviceApiKeyMiddlewareLayer),
              HttpRouter.provideRequest(
                Layer.mergeAll(
                  BackendAuth.layer,
                  Layer.effect(Domains, Domains.make),
                  FetchHttpClient.layer,
                  Layer.succeed(
                    Credentials,
                    Effect.succeed(
                      apiTokenCredentials({ apiToken: "unused-test-token" }),
                    ),
                  ),
                  Layer.succeed(Events, events),
                ).pipe(Layer.provide(sqlTestLayer)),
              ),
              Layer.provide(BunHttpPlatform.layer),
              Layer.provide(Etag.layer),
              Layer.provide(BunServices.layer),
            ),
          );
          yield* Effect.gen(function* () {
            const key = yield* Effect.promise(() =>
              auth.api.createApiKey({
                body: { configId: "service", userId: id },
              }),
            );
            const send = (
              method: string,
              path: string,
              credential?: string,
              payload?: typeof Schema.Json.Type,
            ) => {
              const headers = new Headers({
                "content-type": "application/json",
                "x-organization-id": "forged-tenant",
                "x-user-id": "forged-user",
              });
              if (credential) headers.set("x-api-key", credential);
              return Effect.promise(() =>
                web.handler(
                  new Request(`${base}/api${path}`, {
                    method,
                    headers,
                    body:
                      payload === undefined
                        ? undefined
                        : JSON.stringify(payload),
                  }),
                ),
              );
            };
            const payload = {
              hostname,
              rootHostname: "example.test",
              managed: false,
            };
            expect(
              (yield* send("POST", "/domains", undefined, payload)).status,
            ).toBe(401);
            expect(
              (yield* send("POST", "/domains", "invalid", payload)).status,
            ).toBe(401);
            const created = yield* send("POST", "/domains", key.key, payload);
            expect(created.status).toBe(200);
            const domain = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ id: Schema.String }),
            )(yield* Effect.promise(() => created.json()));
            expect(
              (yield* send("DELETE", `/domains/${domain.id}`, key.key)).status,
            ).toBe(200);
            const rows =
              yield* sql`SELECT event_name, organization_id, payload_json::text AS payload FROM events
        WHERE event_name IN ('domain.created', 'domain.deleted') AND payload_json::text LIKE ${`%${domain.id}%`}`;
            expect(rows).toHaveLength(2);
            for (const row of rows) {
              expect(row.organizationId).toBe(
                process.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID,
              );
              expect(row.payload).toContain(key.id);
              expect(row.payload).toContain("api_key");
              expect(row.payload).not.toContain(key.key);
              expect(row.payload).not.toContain("forged-");
            }
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* Effect.promise(web.dispose);
                // Domain targets are opaque IDs, so remove these test records through their key attribution.
                yield* sql`DELETE FROM events WHERE payload_json::text LIKE (SELECT '%' || id || '%' FROM apikey WHERE reference_id = ${id} LIMIT 1)`;
                yield* sql`DELETE FROM domains WHERE hostname = ${hostname}`;
                yield* sql`DELETE FROM apikey WHERE reference_id = ${id}`;
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );
  },
);
