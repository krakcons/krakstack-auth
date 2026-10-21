import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Events } from "@krak-stack/registry/events";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { Etag, HttpRouter } from "effect/http";
import { HttpApi, HttpApiBuilder } from "effect/http-api";
import { SqlClient } from "effect/sql";
import { AdminApi } from "@/api";
import { createAuth } from "@/services/auth/config";
import { adminAuthMiddlewareLayer } from "@/services/auth/middleware.server";
import { sqlTestLayer } from "@/services/database";
import { auditHandler } from "./api.builder";
import { testEventsLayer } from "./test-layer";

const AuditOnlyApi = HttpApi.make("AdminApi").add(AdminApi.groups.audit);

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "audit read HTTP authorization",
  () => {
    it.effect(
      "denies anonymous, nonadmin and impersonated readers and pins verified admins to the configured tenant",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const id = crypto.randomUUID();
          const tenant = `audit-global-${id}`;
          const otherTenant = `audit-other-${id}`;
          const base = new URL(
            process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
          ).origin;
          const auth = createAuth({ allowedHosts: [new URL(base).host] });
          const context = yield* Effect.promise(() => auth.$context);
          const queriedTenants: Array<string> = [];
          const observedEvents = Layer.succeed(Events, {
            ...events,
            list: (input) => {
              queriedTenants.push(input.organizationId);
              expect(input.category).toBe("audit");
              return events.list(input);
            },
          });
          const configuredTenant = Layer.succeed(
            ConfigProvider.ConfigProvider,
            ConfigProvider.orElse(
              ConfigProvider.fromUnknown({
                VITE_KRAKSTACK_AUTH_ORGANIZATION_ID: tenant,
              }),
              yield* ConfigProvider.ConfigProvider,
            ),
          );
          const web = HttpRouter.toWebHandler(
            HttpApiBuilder.layer(AuditOnlyApi).pipe(
              Layer.provide(auditHandler),
              Layer.provide(adminAuthMiddlewareLayer),
              HttpRouter.provideRequest(
                Layer.merge(observedEvents, configuredTenant),
              ),
              Layer.provide(BunHttpPlatform.layer),
              Layer.provide(Etag.layer),
              Layer.provide(BunServices.layer),
            ),
          );
          const now = new Date();
          yield* sql`INSERT INTO "user" (id, name, email, email_verified, role) VALUES (${id}, 'Audit reader', ${`${id}@example.test`}, true, 'user')`;
          yield* Effect.gen(function* () {
            const password = "audit-reader-password";
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
              .map((value) => value.split(";")[0])
              .join("; ");
            const read = (withCookie: boolean) =>
              web.handler(
                new Request(
                  `${base}/api/auth/admin/audit?page=0&pageSize=10&globalFilter=${id}&organizationId=${otherTenant}`,
                  {
                    headers: withCookie
                      ? { cookie, "x-organization-id": otherTenant }
                      : {},
                  },
                ),
              );
            expect((yield* Effect.promise(() => read(false))).status).toBe(401);
            expect((yield* Effect.promise(() => read(true))).status).toBe(403);
            // A valid admin session with organization impersonation must remain denied.
            yield* sql`UPDATE "user" SET role = 'admin' WHERE id = ${id}`;
            yield* sql`UPDATE session SET impersonated_by_organization_id = ${otherTenant}, active_organization_id = ${otherTenant} WHERE user_id = ${id}`;
            // Remove cookie cache to force all following checks through trusted storage.
            const tokenCookie = signedIn.headers
              .getSetCookie()
              .filter((value) => value.split("=")[0]?.endsWith("session_token"))
              .map((value) => value.split(";")[0])
              .join("; ");
            const adminRead = (eventName?: string) =>
              web.handler(
                new Request(
                  `${base}/api/auth/admin/audit?page=0&pageSize=10&globalFilter=${id}&organizationId=${otherTenant}&category=analytics${eventName ? `&eventName=${encodeURIComponent(eventName)}` : ""}`,
                  {
                    headers: {
                      cookie: tokenCookie,
                      "x-organization-id": otherTenant,
                    },
                  },
                ),
              );
            expect((yield* Effect.promise(() => adminRead())).status).toBe(403);
            yield* sql`UPDATE session SET impersonated_by_organization_id = NULL WHERE user_id = ${id}`;
            yield* events
              .track({
                name: "audit.global_test",
                category: "audit",
                target: { id, name: id, type: "audit_test" },
              })
              .pipe(
                Effect.annotateLogs({
                  "organization.id": tenant,
                  "app.actor.type": "user",
                  "app.actor.id": id,
                }),
              );
            yield* events
              .track({
                name: "audit.other_tenant_test",
                category: "audit",
                target: { id, name: id, type: "audit_test" },
              })
              .pipe(Effect.annotateLogs({ "organization.id": otherTenant }));
            expect(
              (yield* events.list({
                category: "audit",
                organizationId: tenant,
                globalFilter: id,
              })).data.map((row) => row.eventName),
            ).toEqual(["audit.global_test"]);
            const response = yield* Effect.promise(() => adminRead());
            expect(response.status).toBe(200);
            expect(queriedTenants).toEqual([tenant]);
            const body = yield* Schema.decodeUnknownEffect(
              Schema.Struct({
                data: Schema.Array(Schema.Struct({ eventName: Schema.String })),
              }),
            )(yield* Effect.promise(() => response.json()));
            expect(body.data.map((row) => row.eventName)).toEqual([
              "audit.global_test",
            ]);
            const filtered = yield* Effect.promise(() =>
              adminRead("audit.other_tenant_test"),
            );
            expect(filtered.status).toBe(200);
            const filteredBody = yield* Schema.decodeUnknownEffect(
              Schema.Struct({
                data: Schema.Array(Schema.Struct({ eventName: Schema.String })),
                meta: Schema.Struct({ total: Schema.Number }),
              }),
            )(yield* Effect.promise(() => filtered.json()));
            expect(filteredBody.data).toEqual([]);
            expect(filteredBody.meta.total).toBe(0);
            expect(queriedTenants).toEqual([tenant, tenant]);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* Effect.promise(() => web.dispose());
                yield* sql`DELETE FROM organization WHERE user_id = ${id}`;
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
                yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );
  },
);
