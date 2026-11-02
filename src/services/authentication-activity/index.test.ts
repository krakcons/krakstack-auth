import * as Layer from "effect/Layer";
import { describe, expect, it } from "@effect/vitest";
import { Events } from "@krak-stack/registry/events";
import { Clock, ConfigProvider, DateTime, Effect, References } from "effect";
import { SqlClient } from "effect/sql";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sqlTestLayer } from "@/services/database";
import { authenticationActivitySummary } from ".";
import { trackActiveUser } from "./active-user";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Authentication activity",
  () => {
    it.effect(
      "deduplicates daily checks, isolates projects, and retains earlier UTC days",
      () => {
        const organizationId = `activity-${crypto.randomUUID()}`;
        return Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const today = Date.UTC(2026, 9, 8, 12);
          let time = today;
          const clock = yield* Clock.Clock;
          const session = {
            user: { id: "user-a" },
            session: {
              userId: "user-a",
              expiresAt: new Date(today + 86400000),
            },
          };
          yield* Effect.gen(function* () {
            yield* trackActiveUser(session, "project-a");
            yield* trackActiveUser(session, "project-a");
            yield* trackActiveUser(session, "project-b");
            yield* trackActiveUser(
              {
                user: { id: "user-b" },
                session: { ...session.session, userId: "user-b" },
              },
              "project-a",
            );
            yield* trackActiveUser(session, null);
            const stored =
              yield* sql`SELECT event_id FROM events WHERE organization_id = ${organizationId}`;
            expect(stored).toHaveLength(4);
            // Audit records must not affect active-user counts.
            yield* events
              .track({
                name: "auth.session.signed_in",
                category: "audit",
                identity: { userId: "audit-only-user", organizationId },
                target: {
                  id: "operation",
                  name: "operation",
                  type: "auth_operation",
                },
                properties: { projectId: "project-a" },
              })
              .pipe(
                Effect.provideService(References.CurrentLogAnnotations, {
                  "app.actor.type": "user",
                  "app.actor.id": "audit-only-user",
                  "user.id": "audit-only-user",
                  "organization.id": organizationId,
                }),
              );
            expect(
              (yield* authenticationActivitySummary({})).dailyActiveUsers,
            ).toBe(2);
            expect(
              (yield* authenticationActivitySummary({ projectId: "project-a" }))
                .dailyActiveUsers,
            ).toBe(2);
            expect(
              (yield* authenticationActivitySummary({ projectId: "project-b" }))
                .dailyActiveUsers,
            ).toBe(1);
            expect(
              (yield* authenticationActivitySummary({ projectId: "unknown" }))
                .dailyActiveUsers,
            ).toBe(0);
            time = today + 86400000;
            expect(
              (yield* authenticationActivitySummary({})).dailyActiveUsers,
            ).toBe(0);
            yield* trackActiveUser(
              {
                ...session,
                session: {
                  ...session.session,
                  expiresAt: new Date(today + 3 * 86400000),
                },
              },
              "project-a",
            );
            const history = yield* authenticationActivitySummary({ days: 7 });
            expect(history.dailyActiveUsers).toBe(1);
            expect(history.dailyActiveUsersByDay).toHaveLength(7);
            expect(history.dailyActiveUsersByDay.at(-2)).toEqual({
              date: "2026-10-08",
              count: 2,
            });
            expect(history.dailyActiveUsersByDay.at(-1)).toEqual({
              date: "2026-10-09",
              count: 1,
            });
            expect(history.dailyActiveUsersByDay[0]?.count).toBe(0);
          }).pipe(
            Effect.ensuring(
              sql`DELETE FROM events WHERE organization_id = ${organizationId}`.pipe(
                Effect.orDie,
              ),
            ),
            Effect.provideService(Clock.Clock, {
              currentTimeNanos: clock.currentTimeNanos,
              currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
              monotonicTimeNanos: clock.monotonicTimeNanos,
              monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
              sleep: (duration) => clock.sleep(duration),
              currentTimeMillis: Effect.sync(() => time),
              currentTimeMillisUnsafe: () => time,
            }),
          );
        }).pipe(
          Effect.provide(
            testEventsLayer.pipe(
              Layer.provideMerge(sqlTestLayer),
              Layer.provideMerge(
                ConfigProvider.layer(
                  ConfigProvider.orElse(
                    ConfigProvider.fromUnknown({
                      VITE_KRAKSTACK_AUTH_ORGANIZATION_ID: organizationId,
                    }),
                    ConfigProvider.fromEnv(),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );

    it.effect(
      "does not record anonymous, expired, impersonated, or invalid sessions",
      () => {
        const organizationId = `activity-${crypto.randomUUID()}`;
        return Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const now = DateTime.toEpochMillis(yield* DateTime.now);
          const session = {
            user: { id: "user" },
            session: { userId: "user", expiresAt: new Date(now + 86400000) },
          };
          yield* Effect.gen(function* () {
            yield* trackActiveUser(
              { ...session, user: { id: "user", isAnonymous: true } },
              "project",
            );
            yield* trackActiveUser(
              {
                ...session,
                session: { ...session.session, expiresAt: new Date(now) },
              },
              "project",
            );
            yield* trackActiveUser(
              {
                ...session,
                session: { ...session.session, impersonatedBy: "admin" },
              },
              "project",
            );
            yield* trackActiveUser(
              {
                ...session,
                session: {
                  ...session.session,
                  impersonatedByOrganizationId: "org",
                },
              },
              "project",
            );
            yield* trackActiveUser(
              { ...session, user: { id: "different" } },
              "project",
            );
            expect(
              yield* sql`SELECT event_id FROM events WHERE organization_id = ${organizationId}`,
            ).toHaveLength(0);
          }).pipe(
            Effect.ensuring(
              sql`DELETE FROM events WHERE organization_id = ${organizationId}`.pipe(
                Effect.orDie,
              ),
            ),
          );
        }).pipe(
          Effect.provide(
            testEventsLayer.pipe(
              Layer.provideMerge(sqlTestLayer),
              Layer.provideMerge(
                ConfigProvider.layer(
                  ConfigProvider.orElse(
                    ConfigProvider.fromUnknown({
                      VITE_KRAKSTACK_AUTH_ORGANIZATION_ID: organizationId,
                    }),
                    ConfigProvider.fromEnv(),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  },
);
