import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Webhooks } from "@krak-stack/registry/webhooks";
import { webhookMigrationsLayer } from "@krak-stack/registry/webhooks/migrations";
import { Effect, Layer, Schema } from "effect";
import { Etag, HttpClient, HttpClientResponse, HttpRouter } from "effect/http";
import { HttpApi, HttpApiBuilder } from "effect/http-api";
import { SqlClient } from "effect/sql";
import { WorkflowEngine } from "effect/workflow";
import { AdminApi } from "@/api";
import { createAuth } from "@/services/auth/config";
import { adminAuthMiddlewareLayer } from "@/services/auth/middleware.server";
import { sqlTestLayer } from "@/services/database";
import { ProjectWebhooks } from "./index";
import { projectWebhooksHandler } from "./api.builder";
import {
  legacyDeletionWebhookName,
  projectWebhookName,
  ProjectWebhookSummary,
  WebhookDeliveries,
} from "./schema";

const http = HttpClient.make((request) =>
  Effect.succeed(
    HttpClientResponse.fromWeb(request, new Response(null, { status: 204 })),
  ),
);
const services = ProjectWebhooks.layer.pipe(
  Layer.provideMerge(
    Webhooks.layerWithoutMigrations.pipe(
      Layer.provide(webhookMigrationsLayer),
      Layer.provide(Layer.succeed(HttpClient.HttpClient, http)),
      Layer.provide(WorkflowEngine.layerMemory),
    ),
  ),
  Layer.provideMerge(sqlTestLayer),
);

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Project webhook monitoring",
  () => {
    it.effect(
      "lists setup state without secrets and isolates paginated delivery history by project",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* ProjectWebhooks;
          const first = crypto.randomUUID();
          const second = crypto.randomUUID();
          const empty = crypto.randomUUID();
          const projects: string[] = [first, second, empty];
          const endpointId = crypto.randomUUID();
          const otherEndpointId = crypto.randomUUID();
          const legacyId = crypto.randomUUID();
          yield* Effect.addFinalizer(() =>
            Effect.gen(function* () {
              yield* sql`DELETE FROM webhooks WHERE ${sql.in("organization_id", projects)}`;
              yield* sql`DELETE FROM project WHERE ${sql.in("id", projects)}`;
            }).pipe(Effect.orDie),
          );
          for (const id of projects)
            yield* sql`INSERT INTO project (id, name) VALUES (${id}, ${id})`;
          for (const [id, projectId, name] of [
            [endpointId, first, projectWebhookName],
            [otherEndpointId, second, projectWebhookName],
            [legacyId, first, legacyDeletionWebhookName],
          ]) {
            yield* sql`INSERT INTO webhooks (id, organization_id, name, url, secret) VALUES (${id}, ${projectId}, ${name}, 'https://example.com/api/webhooks/auth', 'private-test-signing-secret')`;
          }
          const ids = [crypto.randomUUID(), crypto.randomUUID()];
          yield* sql`INSERT INTO webhook_deliveries (id, webhook_id, event, data, status, error, retries) VALUES
      (${ids[0]}, ${endpointId}, 'user.deletion_requested', '{"userId":"deleted-user"}', 'success', NULL, 0),
      (${ids[1]}, ${endpointId}, 'user.updated', '{}', 'failed', 'HTTP 500', 3),
      (${crypto.randomUUID()}, ${otherEndpointId}, 'other-project-only', '{}', 'success', NULL, 0),
      (${crypto.randomUUID()}, ${legacyId}, 'legacy-only', '{}', 'success', NULL, 0)`;
          const listed = (yield* service.list()).filter((row) =>
            projects.includes(row.projectId),
          );
          expect(listed).toHaveLength(3);
          expect(listed.find((row) => row.projectId === empty)).toMatchObject({
            url: null,
            enabled: null,
          });
          expect(JSON.stringify(listed)).not.toContain(
            "private-test-signing-secret",
          );
          const page = yield* service.deliveries({
            projectId: first,
            query: {
              page: 0,
              pageSize: 1,
              sort: [{ id: "event", direction: "asc" }],
            },
          });
          expect(page?.meta.total).toBe(2);
          expect(page?.data.map((row) => row.id)).toEqual([ids[0]]);
          const next = yield* service.deliveries({
            projectId: first,
            query: {
              page: 1,
              pageSize: 1,
              sort: [{ id: "event", direction: "asc" }],
            },
          });
          expect(next?.data.map((row) => row.id)).toEqual([ids[1]]);
          const failed = yield* service.deliveries({
            projectId: first,
            query: {
              page: 0,
              pageSize: 20,
              filters: [{ id: "status", kind: "values", values: ["failed"] }],
            },
          });
          expect(failed?.data).toMatchObject([
            { id: ids[1], error: "HTTP 500", retries: 3 },
          ]);
          expect(
            yield* service.deliveries({
              projectId: empty,
              query: { page: 0, pageSize: 20 },
            }),
          ).toBeNull();
        }).pipe(Effect.scoped, Effect.provide(services)),
    );

    it.effect(
      "protects endpoint and delivery reads with admin authorization and validates queries",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* ProjectWebhooks;
          const id = crypto.randomUUID();
          const endpointId = crypto.randomUUID();
          const base = new URL(
            process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
          ).origin;
          const auth = createAuth({
            allowedHosts: [new URL(base).host],
            auditRun: async () => {},
          });
          const context = yield* Effect.promise(() => auth.$context);
          const api = HttpApi.make("AdminApi").add(
            AdminApi.groups.projectWebhooks,
          );
          const web = HttpRouter.toWebHandler(
            HttpApiBuilder.layer(api).pipe(
              Layer.provide(projectWebhooksHandler),
              Layer.provide(adminAuthMiddlewareLayer),
              HttpRouter.provideRequest(
                Layer.succeed(ProjectWebhooks, service),
              ),
              Layer.provide(BunHttpPlatform.layer),
              Layer.provide(Etag.layer),
              Layer.provide(BunServices.layer),
            ),
          );
          yield* Effect.addFinalizer(() => Effect.promise(() => web.dispose()));
          yield* Effect.addFinalizer(() =>
            Effect.gen(function* () {
              yield* sql`DELETE FROM webhooks WHERE organization_id = ${id}`;
              yield* sql`DELETE FROM project WHERE id = ${id}`;
              yield* sql`DELETE FROM "user" WHERE id = ${id}`;
            }).pipe(Effect.orDie),
          );
          yield* sql`INSERT INTO "user" (id, name, email, email_verified, role) VALUES (${id}, 'Webhook reader', ${`${id}@example.test`}, true, 'user')`;
          yield* sql`INSERT INTO project (id, name) VALUES (${id}, 'Webhook project')`;
          yield* sql`INSERT INTO webhooks (id, organization_id, name, url, secret) VALUES (${endpointId}, ${id}, ${projectWebhookName}, 'https://example.com', 'secret-not-for-list')`;
          yield* sql`INSERT INTO webhook_deliveries (id, webhook_id, event) VALUES (${crypto.randomUUID()}, ${endpointId}, 'user.deletion_requested')`;
          const password = "webhook-reader-test-password";
          const now = new Date();
          const hash = yield* Effect.promise(() =>
            context.password.hash(password),
          );
          yield* Effect.promise(() =>
            context.internalAdapter.createAccount({
              userId: id,
              accountId: id,
              providerId: "credential",
              password: hash,
              createdAt: now,
              updatedAt: now,
            }),
          );
          const signedIn = yield* Effect.promise(() =>
            auth.api.signInEmail({
              body: { email: `${id}@example.test`, password },
              returnHeaders: true,
            }),
          );
          const cookie = signedIn.headers
            .getSetCookie()
            .filter((value) => value.split("=")[0]?.endsWith("session_token"))
            .map((value) => value.split(";")[0])
            .join("; ");
          const read = (path: string, authenticated = true) =>
            Effect.promise(() =>
              web.handler(
                new Request(`${base}/api/auth${path}`, {
                  headers: authenticated ? { cookie } : {},
                }),
              ),
            );
          const paths = [
            "/admin/webhooks",
            `/admin/projects/${id}/webhook/deliveries`,
          ];
          for (const path of paths) {
            expect((yield* read(path, false)).status).toBe(401);
            expect((yield* read(path)).status).toBe(403);
          }
          yield* sql`UPDATE "user" SET role = 'admin' WHERE id = ${id}`;
          const listed = yield* read(paths[0]!);
          expect(listed.status).toBe(200);
          const body = yield* Effect.promise(() => listed.json());
          expect(
            (yield* Schema.decodeUnknownEffect(
              Schema.Array(ProjectWebhookSummary),
            )(body).pipe(Effect.orDie)).some((row) => row.projectId === id),
          ).toBe(true);
          expect(JSON.stringify(body)).not.toContain("secret-not-for-list");
          const deliveries = yield* read(paths[1]!);
          expect(deliveries.status).toBe(200);
          expect(
            (yield* Schema.decodeUnknownEffect(
              Schema.toCodecJson(WebhookDeliveries),
            )(yield* Effect.promise(() => deliveries.json())).pipe(
              Effect.orDie,
            )).data,
          ).toHaveLength(1);
          expect((yield* read(`${paths[1]}?pageSize=101`)).status).toBe(400);
          expect(
            (yield* read(
              `/admin/projects/${crypto.randomUUID()}/webhook/deliveries`,
            )).status,
          ).toBe(404);
          yield* sql`UPDATE session SET impersonated_by_organization_id = 'another-organization' WHERE user_id = ${id}`;
          for (const path of paths)
            expect((yield* read(path)).status).toBe(403);
        }).pipe(Effect.scoped, Effect.provide(services)),
      { timeout: 30_000 },
    );
  },
);
