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
import { adminApiHandler } from "./api.builder";

// This suite exercises persistence and HTTP codecs. Authentication has separate
// coverage; no production authorization implementation is replaced here.
const handlerLayer = adminApiHandler.pipe(
  HttpRouter.provideRequest(
    Layer.mergeAll(
      Organizations.layer,
      Domains.testLayer,
      sqlTestLayer,
      FetchHttpClient.layer,
      CredentialsFromEnv,
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
        yield* sql`INSERT INTO apikey (id, key, config_id, reference_id, created_at, updated_at) VALUES (${id}, ${id}, 'service', ${id}, ${now}, ${now})`;
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
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`DELETE FROM apikey WHERE reference_id = ${id}`;
            yield* sql`DELETE FROM project WHERE id = ${id}`;
            yield* sql`DELETE FROM "user" WHERE id = ${id}`;
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
});
