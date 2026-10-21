import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { SqlClient } from "effect/sql";
import {
  Credentials,
  apiTokenCredentials,
} from "@distilled.cloud/cloudflare/Credentials";
import { Events } from "@krak-stack/registry/events";
import { EventsPersistenceError } from "@krak-stack/registry/events/schema";
import { vi } from "vitest";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sqlTestLayer } from "@/services/database";
import { Domains } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "domain audit boundaries",
  () => {
    it.effect(
      "audits successful Cloudflare actions only, deduplicates status, and distinguishes external effects from SQL rollback",
      () => {
        const id = crypto.randomUUID();
        const hostname = `private-${id}.example.test`;
        const requests: Array<string> = [];
        let cloudflareFailure = true;
        const http = HttpClient.make((request) =>
          Effect.sync(() => {
            requests.push(request.method);
            return HttpClientResponse.fromWeb(
              request,
              new Response(
                JSON.stringify({
                  success: !cloudflareFailure,
                  errors: cloudflareFailure
                    ? [{ code: 1000, message: "PRIVATE-upstream-error" }]
                    : [],
                  messages: [],
                  result: { id, hostname, status: "active" },
                }),
                {
                  status: cloudflareFailure ? 400 : 200,
                  headers: { "content-type": "application/json" },
                },
              ),
            );
          }),
        );
        return Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const domains = yield* Domains;
          const events = yield* Events;
          vi.stubEnv("AUTH_CLOUDFLARE_ZONE_ID", "private-zone");
          const rejected = {
            ...events,
            track: vi.fn(() =>
              Effect.fail(new EventsPersistenceError({ operation: "reject" })),
            ),
          };
          yield* Effect.gen(function* () {
            expect(
              (yield* domains
                .create({
                  payload: {
                    hostname,
                    rootHostname: "example.test",
                    managed: true,
                  },
                })
                .pipe(Effect.provideService(Events, rejected), Effect.result))
                ._tag,
            ).toBe("Failure");
            expect(requests).toEqual(["POST"]);
            expect(rejected.track).not.toHaveBeenCalled();
            cloudflareFailure = false;
            expect(
              (yield* domains
                .create({
                  payload: {
                    hostname,
                    rootHostname: "example.test",
                    managed: true,
                  },
                })
                .pipe(Effect.provideService(Events, rejected), Effect.result))
                ._tag,
            ).toBe("Failure");
            expect(rejected.track).toHaveBeenCalledTimes(1);
            expect(
              yield* sql`SELECT id FROM domains WHERE hostname = ${hostname}`,
            ).toEqual([]);
            const domain = yield* domains.create({
              payload: {
                hostname,
                rootHostname: "example.test",
                managed: true,
              },
            });
            if (!domain) return yield* Effect.die("Domain missing");
            expect(domain.active).toBe(false);
            expect(requests).toEqual(["POST", "POST", "POST"]);
            yield* domains.records({ id: domain.id });
            yield* domains.records({ id: domain.id });
            expect(
              (yield* sql`SELECT active FROM domains WHERE id = ${domain.id}`)[0]
                ?.active,
            ).toBe(true);
            expect(
              yield* sql`SELECT event_name FROM events WHERE event_name = 'domain.status_changed' AND payload_json::text LIKE ${`%${domain.id}%`}`,
            ).toHaveLength(1);
            expect(
              (yield* domains
                .update({
                  id: domain.id,
                  payload: {
                    hostname,
                    rootHostname: "changed.example.test",
                    managed: true,
                  },
                })
                .pipe(Effect.provideService(Events, rejected), Effect.result))
                ._tag,
            ).toBe("Failure");
            expect(
              (yield* sql`SELECT root_hostname FROM domains WHERE id = ${domain.id}`)[0]
                ?.rootHostname,
            ).toBe("example.test");
            yield* domains.delete({ id: domain.id });
            expect(requests).toEqual([
              "POST",
              "POST",
              "POST",
              "GET",
              "GET",
              "DELETE",
            ]);
            expect(yield* domains.get({ id: domain.id })).toBeNull();
            const audit =
              yield* sql`SELECT event_name, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${domain.id}%`}`;
            expect(audit.map((row) => row.eventName).sort()).toEqual(
              [
                "domain.created",
                "domain.deleted",
                "domain.deprovisioned",
                "domain.provisioned",
                "domain.status_changed",
              ].sort(),
            );
            for (const event of audit)
              expect(event.payload).not.toMatch(
                /private-|example.test|private-zone/,
              );
            yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${domain.id}%`}`;
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                vi.unstubAllEnvs();
                yield* sql`DELETE FROM domains WHERE hostname = ${hostname}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(Layer.effect(Domains, Domains.make)),
          Effect.provideService(HttpClient.HttpClient, http),
          Effect.provideService(
            Credentials,
            Effect.succeed(
              apiTokenCredentials({ apiToken: "never-used-real-token" }),
            ),
          ),
          Effect.provide(testEventsLayer),
          Effect.provide(sqlTestLayer),
        );
      },
    );
  },
);
