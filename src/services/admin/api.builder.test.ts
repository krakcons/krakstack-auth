import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Etag, FetchHttpClient, HttpRouter } from "effect/http";
import { CredentialsFromEnv } from "@distilled.cloud/cloudflare";
import { HttpApiTest } from "effect/http-api";
import { SqlClient } from "effect/sql";

import { AdminApi } from "@/api";
import { AdminAuthMiddleware } from "@/services/auth/middleware";
import { sqlTestLayer } from "@/services/database";
import { Domains } from "@/services/domains";
import { Organizations } from "@/services/organizations";
import { testEventsLayer } from "@/services/audit/test-layer";
import {
  adminApiHandler,
  deleteApiKey,
  updateApiKey,
  resetApiKeyRateLimit,
} from "./api.builder";

// This suite exercises persistence and HTTP codecs. Authentication has separate
// coverage; no production authorization implementation is replaced here.
const handlerLayer = adminApiHandler.pipe(
  Layer.provide(testEventsLayer),
  HttpRouter.provideRequest(
    Layer.mergeAll(
      Organizations.layer,
      Domains.testLayer,
      sqlTestLayer,
      FetchHttpClient.layer,
      CredentialsFromEnv,
      testEventsLayer,
    ),
  ),
  Layer.provideMerge(Layer.succeed(AdminAuthMiddleware, (effect) => effect)),
);

describe.skipIf(!process.env.TEST_DATABASE_URL)("Admin SQL handlers", () => {
  it.effect(
    "preserves pagination, relationship previews, aggregates and API key updates",
    () => {
      const id = `admin-sql-${crypto.randomUUID()}`;
      return Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const now = new Date();
        yield* sql`INSERT INTO project (id, name) VALUES (${id}, ${id})`;
        yield* sql`INSERT INTO "user" (id, name, email) VALUES (${id}, ${id}, ${`${id}@example.com`})`;
        yield* sql`INSERT INTO organization (id, name, slug, user_id, created_at) VALUES (${id}, ${id}, ${id}, ${id}, ${now})`;
        yield* sql`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (${id}, ${id}, ${id}, 'owner', ${now})`;
        yield* sql`INSERT INTO project_user (id, project_id, user_id) VALUES (${id}, ${id}, ${id})`;
        yield* sql`INSERT INTO project_organization (id, project_id, organization_id) VALUES (${id}, ${id}, ${id})`;
        yield* sql`INSERT INTO session (id, token, user_id, created_at, updated_at, expires_at) VALUES (${id}, ${id}, ${id}, ${now}, ${now}, ${new Date(Date.now() + 60_000)})`;
        yield* sql`INSERT INTO apikey (id, key, config_id, reference_id, created_at, updated_at) VALUES (${id}, 'never-log-this-key', 'service', ${id}, ${now}, ${now})`;
        const client = yield* HttpApiTest.groups(AdminApi, ["admin"]);
        const query = {
          page: 0,
          pageSize: 10,
          globalFilter: id,
          projectId: id,
        };
        const users = yield* client.admin.listUsers({ query });
        expect(users.meta.total).toBe(1);
        expect(users.data[0]?.id).toBe(id);
        expect(users.data[0]?.projects).toEqual([{ id, name: id, logo: null }]);
        expect(users.data[0]?.organizations).toEqual([
          { id, name: id, logo: null },
        ]);
        expect(users.data[0]?.lastSignedIn).toBeInstanceOf(Date);
        expect(users.data[0]?.lastSignedIn?.getTime()).toBe(now.getTime());
        const day = now.toISOString().slice(0, 10);
        const filteredUsers = yield* client.admin.listUsers({
          query: {
            ...query,
            filters: [
              { id: "email", kind: "text", operator: "startsWith", value: id },
              { id: "banned", kind: "boolean", value: false },
              { id: "lastSignedIn", kind: "date", from: day, to: day },
            ],
            pageSize: 1,
            page: 1,
          },
        });
        expect(filteredUsers.data).toEqual([]);
        expect(filteredUsers.meta.total).toBe(1);
        for (const value of ["%", "_", "' OR 1=1 --"]) {
          expect(
            (yield* client.admin.listUsers({
              query: {
                ...query,
                filters: [
                  { id: "email", kind: "text", operator: "contains", value },
                ],
              },
            })).meta.total,
          ).toBe(0);
        }
        expect(
          (yield* client.admin.listUsers({
            query: {
              ...query,
              projectId: `${id}-missing`,
              filters: [{ id: "banned", kind: "boolean", value: false }],
            },
          })).meta.total,
        ).toBe(0);
        const organizations = yield* client.admin.listOrganizations({ query });
        expect(organizations.meta.total).toBe(1);
        expect(organizations.data[0]?.memberCount).toBe(1);
        expect(organizations.data[0]?.memberPreviews?.[0]).toMatchObject({
          id,
          role: "owner",
        });
        expect(organizations.data[0]?.projects).toEqual([
          { id, name: id, logo: null },
        ]);
        expect(
          (yield* client.admin.listOrganizations({
            query: {
              ...query,
              filters: [
                { id: "userId", kind: "values", values: ["personal"] },
                { id: "createdAt", kind: "date", from: day, to: day },
              ],
            },
          })).meta.total,
        ).toBe(1);
        expect(
          (yield* client.admin.listOrganizations({
            query: {
              ...query,
              filters: [{ id: "userId", kind: "values", values: ["standard"] }],
            },
          })).meta.total,
        ).toBe(0);
        expect(
          (yield* client.admin.listOrganizations({
            query: {
              ...query,
              projectId: `${id}-missing`,
              filters: [{ id: "userId", kind: "values", values: ["personal"] }],
            },
          })).meta.total,
        ).toBe(0);
        const stats = yield* client.admin.dashboardStats({
          query: { days: "7" },
        });
        expect(stats.projectConnections).toContainEqual({
          projectId: id,
          projectName: id,
          users: 1,
          organizations: 1,
        });
        expect(stats.dailyActiveUsersByDay).toHaveLength(7);
        const updated = yield* client.admin.updateApiKey({
          params: { id },
          payload: {
            name: " SQL key ",
            enabled: false,
            referrers: ["https://example.com"],
          },
        });
        expect(updated.name).toBe("SQL key");
        expect(updated.enabled).toBe(false);
        expect(updated.referrers).toEqual(["https://example.com"]);
        expect(
          (yield* client.admin.disableApiKeyRateLimit({ params: { id } }))
            .rateLimitEnabled,
        ).toBe(false);
        expect(
          (yield* client.admin.enableApiKeyRateLimit({ params: { id } }))
            .rateLimitEnabled,
        ).toBe(true);
        expect(
          (yield* client.admin.resetApiKeyRateLimit({ params: { id } }))
            .requestCount,
        ).toBe(0);
        expect((yield* client.admin.deleteApiKey({ params: { id } })).id).toBe(
          id,
        );
        const events =
          yield* sql`SELECT event_name, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${id}%`} ORDER BY occurred_at`;
        expect(events.map((event) => event.eventName).sort()).toEqual([
          "api_key.deleted",
          "api_key.rate_limit_reset",
          "api_key.updated",
          "api_key.updated",
          "api_key.updated",
        ]);
        for (const event of events) {
          expect(event.payload).not.toContain("SQL key");
          expect(event.payload).not.toContain("https://example.com");
          expect(event.payload).not.toContain("never-log-this-key");
        }
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`DELETE FROM apikey WHERE reference_id = ${id}`;
            yield* sql`DELETE FROM project WHERE id = ${id}`;
            yield* sql`DELETE FROM "user" WHERE id = ${id}`;
            yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
          }).pipe(Effect.orDie),
        ),
        Effect.provide(handlerLayer),
        Effect.provide(sqlTestLayer),
        Effect.provide(BunHttpPlatform.layer),
        Effect.provide(Etag.layer),
        Effect.provide(BunServices.layer),
        Effect.scoped,
      );
    },
  );

  it.effect(
    "rolls back every API-key control when audit persistence fails",
    () => {
      const id = crypto.randomUUID();
      const constraint = `reject_api_key_audit_${id.replaceAll("-", "")}`;
      return Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`INSERT INTO apikey (id, key, config_id, reference_id, enabled, request_count, created_at, updated_at) VALUES (${id}, 'never-log-this-key', 'service', ${id}, true, 7, now(), now())`;
        yield* sql`ALTER TABLE events ADD CONSTRAINT ${sql(constraint)} CHECK (event_name NOT LIKE 'api_key.%') NOT VALID`;
        yield* Effect.gen(function* () {
          const operations = [
            updateApiKey({
              id,
              payload: {
                enabled: false,
                referrers: ["https://private.example.test"],
              },
            }),
            updateApiKey({ id, payload: { rateLimitEnabled: true } }),
            updateApiKey({ id, payload: { rateLimitEnabled: false } }),
            resetApiKeyRateLimit(id),
            deleteApiKey(id),
          ];
          for (const operation of operations) {
            expect((yield* operation.pipe(Effect.result))._tag).toBe("Failure");
            const [key] =
              yield* sql`SELECT enabled, request_count, metadata FROM apikey WHERE id = ${id}`;
            expect(key).toMatchObject({
              enabled: true,
              requestCount: 7,
              metadata: null,
            });
            expect(
              yield* sql`SELECT event_id FROM events WHERE payload_json::text LIKE ${`%${id}%`}`,
            ).toEqual([]);
          }
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* sql`ALTER TABLE events DROP CONSTRAINT ${sql(constraint)}`;
              yield* sql`DELETE FROM apikey WHERE id = ${id}`;
            }).pipe(Effect.orDie),
          ),
        );
      }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer));
    },
  );

  it.effect("does not audit missing API keys", () =>
    Effect.gen(function* () {
      const id = crypto.randomUUID();
      const sql = yield* SqlClient.SqlClient;
      for (const operation of [
        deleteApiKey(id),
        resetApiKeyRateLimit(id),
        updateApiKey({ id, payload: { enabled: false } }),
      ]) {
        expect(yield* operation.pipe(Effect.flip)).toMatchObject({
          _tag: "NotFound",
        });
      }
      expect(
        yield* sql`SELECT event_id FROM events WHERE payload_json::text LIKE ${`%${id}%`}`,
      ).toEqual([]);
    }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
  );
});
