import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { vi } from "vitest";
import { Events } from "@krak-stack/registry/events";
import {
  EventsPersistenceError,
  type TrackEvent,
} from "@krak-stack/registry/events/schema";
import { testEventsLayer } from "@/services/audit/test-layer";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { sqlTestLayer } from "@/services/database";
import { Organizations } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)("organization auditing", () => {
  it.effect(
    "audits only successful Better Auth actions without logging organization data or upstream errors",
    () =>
      Effect.gen(function* () {
        const request = yield* BetterAuthRequest;
        const organizations = yield* Organizations;
        const events = yield* Events;
        const tracked: Array<typeof TrackEvent.Type> = [];
        const recording = {
          ...events,
          track: (event: typeof TrackEvent.Type) =>
            Effect.sync(() => {
              tracked.push(event);
              return { eventId: crypto.randomUUID(), inserted: true };
            }),
        };
        const organization = {
          id: crypto.randomUUID(),
          name: "Private display name",
          slug: "private-org",
          createdAt: new Date(),
          metadata: null,
          members: [],
        };
        const create = vi
          .spyOn(request.api, "createOrganization")
          .mockResolvedValue(organization);
        const remove = vi
          .spyOn(request.api, "deleteOrganization")
          .mockResolvedValue(organization);
        yield* Effect.gen(function* () {
          expect(
            yield* organizations.create({
              payload: { name: organization.name, slug: organization.slug },
            }),
          ).toMatchObject({ id: organization.id });
          expect(
            yield* organizations.delete({ id: organization.id }),
          ).toMatchObject({ id: organization.id });
          create.mockRejectedValue(new Error("private-provider-error"));
          remove.mockRejectedValue(new Error("private-provider-error"));
          expect(
            (yield* organizations
              .create({
                payload: { name: organization.name, slug: organization.slug },
              })
              .pipe(Effect.result))._tag,
          ).toBe("Failure");
          expect(
            (yield* organizations
              .delete({ id: organization.id })
              .pipe(Effect.result))._tag,
          ).toBe("Failure");
          expect(tracked.map((event) => event.name)).toEqual([
            "organization.created",
            "organization.deleted",
          ]);
          expect(tracked.every((event) => event.properties?.operationId)).toBe(
            true,
          );
          for (const event of tracked) {
            expect(JSON.stringify(event)).not.toContain(organization.name);
            expect(JSON.stringify(event)).not.toContain(organization.slug);
            expect(JSON.stringify(event)).not.toContain(
              "private-provider-error",
            );
          }
          create.mockResolvedValue(organization);
          const completionRejected = {
            ...recording,
            track: (event: typeof TrackEvent.Type) =>
              event.name === "organization.created"
                ? Effect.fail(
                    new EventsPersistenceError({
                      operation: "test completion rejection",
                    }),
                  )
                : recording.track(event),
          };
          expect(
            yield* organizations
              .create({
                payload: { name: organization.name, slug: organization.slug },
              })
              .pipe(
                Effect.provideService(Events, completionRejected),
                Effect.flip,
              ),
          ).toMatchObject({ _tag: "EventsPersistenceError" });
          expect(create).toHaveBeenCalledTimes(3);
          expect(tracked).toHaveLength(2);
        }).pipe(
          Effect.provideService(Events, recording),
          Effect.ensuring(
            Effect.sync(() => {
              create.mockRestore();
              remove.mockRestore();
            }),
          ),
        );
      }).pipe(
        Effect.provide(Organizations.layer),
        Effect.provide(
          BetterAuthRequest.make(new Request("https://auth.example.test")),
        ),
        Effect.provide(testEventsLayer),
        Effect.provide(sqlTestLayer),
      ),
  );

  it.effect(
    "audits SQL updates, ignores missing/empty updates, and rolls back on audit failure",
    () => {
      const id = crypto.randomUUID();
      const constraint = `reject_org_audit_${id.replaceAll("-", "")}`;
      return Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const organizations = yield* Organizations;
        yield* sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${id}, 'Original', ${id}, now())`;
        yield* Effect.gen(function* () {
          expect(
            yield* organizations.update({
              id,
              payload: { name: "Private display name" },
            }),
          ).toMatchObject({ name: "Private display name" });
          expect(
            yield* organizations.update({ id, payload: {} }),
          ).not.toBeNull();
          expect(
            yield* organizations.update({
              id: crypto.randomUUID(),
              payload: { name: "Missing" },
            }),
          ).toBeNull();
          const events =
            yield* sql`SELECT event_name, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
          expect(events).toHaveLength(1);
          expect(events[0]?.eventName).toBe("organization.updated");
          expect(events[0]?.payload).not.toContain("Private display name");
          yield* sql`ALTER TABLE events ADD CONSTRAINT ${sql(constraint)} CHECK (event_name <> 'organization.updated') NOT VALID`;
          yield* Effect.gen(function* () {
            expect(
              (yield* organizations
                .update({ id, payload: { name: "Must roll back" } })
                .pipe(Effect.result))._tag,
            ).toBe("Failure");
            expect(
              yield* sql`SELECT name FROM organization WHERE id = ${id}`,
            ).toEqual([{ name: "Private display name" }]);
          }).pipe(
            Effect.ensuring(
              sql`ALTER TABLE events DROP CONSTRAINT ${sql(constraint)}`.pipe(
                Effect.orDie,
              ),
            ),
          );
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* sql`DELETE FROM organization WHERE id = ${id}`;
              yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
            }).pipe(Effect.orDie),
          ),
        );
      }).pipe(
        Effect.provide(Organizations.layer),
        Effect.provide(testEventsLayer),
        Effect.provide(sqlTestLayer),
      );
    },
  );

  it.effect(
    "invokes Better Auth deletion before the success audit and does not claim external rollback",
    () =>
      Effect.gen(function* () {
        const request = yield* BetterAuthRequest;
        const organizations = yield* Organizations;
        const remove = vi
          .spyOn(request.api, "deleteOrganization")
          .mockResolvedValue({
            id: "already-deleted",
            name: "Private",
            slug: "private",
            createdAt: new Date(),
          });
        const events = yield* Events;
        yield* Effect.gen(function* () {
          const rejection = {
            ...events,
            track: () =>
              Effect.fail(
                new EventsPersistenceError({ operation: "test rejection" }),
              ),
          };
          expect(
            (yield* organizations
              .delete({ id: "already-deleted" })
              .pipe(Effect.provideService(Events, rejection), Effect.result))
              ._tag,
          ).toBe("Failure");
          expect(remove).toHaveBeenCalledTimes(1);
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              remove.mockRestore();
            }),
          ),
        );
      }).pipe(
        Effect.provide(Organizations.layer),
        Effect.provide(
          BetterAuthRequest.make(new Request("https://auth.example.test")),
        ),
        Effect.provide(testEventsLayer),
        Effect.provide(sqlTestLayer),
      ),
  );
});
