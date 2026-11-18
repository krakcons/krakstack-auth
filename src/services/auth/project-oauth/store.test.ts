import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { SqlClient } from "effect/sql";
import { sqlTestLayer } from "@/services/database";
import { ProjectOAuthStore } from "./store";

describe.skipIf(!process.env.TEST_DATABASE_URL)("Project OAuth persistence", () => {
  it.effect(
    "binds redemption to browser, origin and registration and consumes only once across concurrent requests",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const store = yield* ProjectOAuthStore;
        const id = crypto.randomUUID();
        const flow = {
          id,
          browserHash: "browser",
          domainId: "domain",
          projectId: "project",
          projectOrigin: "https://learning.example.test",
          destination: "https://learning.example.test/dashboard",
          errorDestination: "https://learning.example.test/sign-in",
          providerOptions: {},
        };
        const codeHash = `code-${id}`;
        yield* Effect.gen(function* () {
          yield* store.create(flow);
          expect(Option.isSome(yield* store.claimStart(id))).toBe(true);
          expect(Option.isNone(yield* store.claimStart(id))).toBe(true);
          const proof = { id, stateCookieHash: "signed-state-cookie" };
          yield* store.bindState({ ...proof, stateHash: `state-${id}` });
          expect(Option.isNone(yield* store.claimCallback({ id, stateCookieHash: "wrong" }))).toBe(
            true,
          );
          expect(Option.isSome(yield* store.claimCallback(proof))).toBe(true);
          expect(Option.isNone(yield* store.claimCallback(proof))).toBe(true);
          yield* store.complete({ id, codeHash, sessionCookie: "encrypted" });

        const input = { ...flow, codeHash, googleEnabled: true, ssoEnabled: false };
          for (const override of [
            { browserHash: "different-browser" },
            { projectOrigin: "https://courses.example.test" },
            { projectId: "different-project" },
            { domainId: "reregistered-domain" },
          ]) {
            expect(Option.isNone(yield* store.redeem({ ...input, ...override }))).toBe(true);
          }
          const results = yield* Effect.all([store.redeem(input), store.redeem(input)], {
            concurrency: 2,
          });
          expect(results.filter(Option.isSome).map(({ value }) => value)).toEqual([
            { destination: flow.destination, sessionCookie: "encrypted" },
          ]);

          yield* store.create(flow);
          yield* store.claimStart(id);
          yield* store.bindState({ ...proof, stateHash: `expired-state-${id}` });
          yield* store.claimCallback(proof);
          yield* store.complete({ id, codeHash, sessionCookie: "encrypted" });
          yield* sql`UPDATE project_oauth_flow SET expires_at = now() WHERE id = ${id}`;
          expect(Option.isNone(yield* store.redeem(input))).toBe(true);
        }).pipe(
          Effect.ensuring(sql`DELETE FROM project_oauth_flow WHERE id = ${id}`.pipe(Effect.orDie)),
        );
      }).pipe(Effect.provide(ProjectOAuthStore.layer), Effect.provide(sqlTestLayer)),
  );
});
