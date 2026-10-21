import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { vi } from "vitest";
import { Events } from "@krak-stack/registry/events";
import {
  EventsPersistenceError,
  type TrackEvent,
} from "@krak-stack/registry/events/schema";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sqlTestLayer } from "@/services/database";
import { OAuthClients } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "OAuth audit boundaries",
  () => {
    it.effect(
      "omits failed retries and invokes the external action before a success audit can fail",
      () =>
        Effect.gen(function* () {
          const clients = yield* OAuthClients;
          const request = yield* BetterAuthRequest;
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
          const update = vi
            .spyOn(request.api, "adminUpdateOAuthClient")
            .mockRejectedValue(new Error("SECRET-UPSTREAM"));
          yield* Effect.gen(function* () {
            for (let attempt = 0; attempt < 2; attempt++) {
              expect(
                (yield* clients
                  .update({
                    clientId: "stable-client",
                    payload: {
                      name: "PRIVATE-NAME",
                      icon: "https://private.example/icon",
                    },
                  })
                  .pipe(
                    Effect.provideService(Events, recording),
                    Effect.result,
                  ))._tag,
              ).toBe("Failure");
            }
            expect(tracked).toEqual([]);
            expect(JSON.stringify(tracked)).not.toMatch(
              /PRIVATE-NAME|private.example|SECRET-UPSTREAM/,
            );
            update.mockResolvedValue({
              client_id: "stable-client",
              client_credentials_scopes: [],
              redirect_uris: [],
            });
            expect(
              (yield* clients
                .update({ clientId: "stable-client", payload: {} })
                .pipe(
                  Effect.provideService(Events, {
                    ...events,
                    track: () =>
                      Effect.fail(
                        new EventsPersistenceError({ operation: "reject" }),
                      ),
                  }),
                  Effect.result,
                ))._tag,
            ).toBe("Failure");
            expect(update).toHaveBeenCalledTimes(3);
          }).pipe(Effect.ensuring(Effect.sync(() => update.mockRestore())));
        }).pipe(
          Effect.provide(Layer.effect(OAuthClients, OAuthClients.make)),
          Effect.provide(
            BetterAuthRequest.make(new Request("https://auth.example.test")),
          ),
          Effect.provide(testEventsLayer),
          Effect.provide(sqlTestLayer),
        ),
    );

    it.effect(
      "rolls back project assignment with its rejected audit, not the upstream mutation",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const clients = yield* OAuthClients;
          const request = yield* BetterAuthRequest;
          const id = crypto.randomUUID();
          const clientId = `https://PRIVATE-client.example/${id}`;
          const constraint = `reject_assignment_${id.replaceAll("-", "")}`;
          const update = vi
            .spyOn(request.api, "adminUpdateOAuthClient")
            .mockResolvedValue({
              client_id: clientId,
              client_credentials_scopes: [],
              redirect_uris: [],
            });
          yield* sql`INSERT INTO project (id, name, data) VALUES (${id}, 'Private project', '{}'::jsonb)`;
          yield* sql`INSERT INTO oauth_client (id, client_id, redirect_uris, created_at, updated_at) VALUES (${id}, ${clientId}, ARRAY[]::text[], now(), now())`;
          yield* Effect.gen(function* () {
            yield* sql`ALTER TABLE events ADD CONSTRAINT ${sql(constraint)} CHECK (event_name <> 'oauth_client.project_assigned') NOT VALID`;
            yield* Effect.gen(function* () {
              expect(
                (yield* clients
                  .update({ clientId, payload: { projectId: id } })
                  .pipe(Effect.result))._tag,
              ).toBe("Failure");
              expect(update).toHaveBeenCalledTimes(1);
              expect(
                yield* sql`SELECT project_id FROM oauth_client WHERE client_id = ${clientId}`,
              ).toEqual([{ projectId: null }]);
              expect(
                (yield* sql`SELECT event_name FROM events WHERE payload_json::text LIKE ${`%${id}%`}`)
                  .map((row) => row.eventName)
                  .sort(),
              ).toEqual([]);
            }).pipe(
              Effect.ensuring(
                sql`ALTER TABLE events DROP CONSTRAINT ${sql(constraint)}`.pipe(
                  Effect.orDie,
                ),
              ),
            );
            expect(
              (yield* clients.update({
                clientId,
                payload: { projectId: id },
              })).projectId,
            ).toBe(id);
            expect(
              yield* sql`SELECT project_id FROM oauth_client WHERE client_id = ${clientId}`,
            ).toEqual([{ projectId: id }]);
            for (const event of yield* sql`SELECT payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${id}%`}`) {
              expect(event.payload).not.toContain(clientId);
              expect(event.payload).not.toContain("Private project");
            }
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                update.mockRestore();
                yield* sql`DELETE FROM oauth_client WHERE client_id = ${clientId}`;
                yield* sql`DELETE FROM project WHERE id = ${id}`;
                yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(Layer.effect(OAuthClients, OAuthClients.make)),
          Effect.provide(
            BetterAuthRequest.make(new Request("https://auth.example.test")),
          ),
          Effect.provide(testEventsLayer),
          Effect.provide(sqlTestLayer),
        ),
    );
  },
);
