import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { UserLocale } from "@krak-stack/auth/schema";

import { sqlTestLayer } from "@/services/database";
import { createAuth } from "./config";
import { resolveRecipientLocale } from "./locale.server";

const LocaleUser = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  locale: UserLocale,
}).annotate({ identifier: "LocaleTestUser" });
const SignedInUser = Schema.Struct({ user: LocaleUser }).annotate({
  identifier: "LocaleTestSignIn",
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "user locale persistence",
  () => {
    it.effect(
      "initializes from the signup flow, persists explicit updates, and resolves recipient language without a request",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const auth = createAuth({ allowedHosts: ["localhost:3001"] });
          const origin = "https://localhost:3001";
          const response = yield* Effect.promise(() =>
            auth.handler(
              new Request(`${origin}/api/auth/sign-in/anonymous`, {
                method: "POST",
                headers: {
                  origin,
                  "content-type": "application/json",
                  "accept-language": "en",
                  cookie: "locale=fr",
                },
                body: "{}",
              }),
            ),
          );
          expect(response.status).toBe(200);
          const { user } = yield* Schema.decodeUnknownEffect(SignedInUser)(
            yield* Effect.promise(() => response.json()),
          );
          const cookie = response.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; ");
          yield* Effect.acquireUseRelease(
            Effect.succeed(user),
            () =>
              Effect.gen(function* () {
                expect(user.locale).toBe("fr");
                expect(
                  yield* resolveRecipientLocale({ email: user.email }),
                ).toBe("fr");
                const update = (body: string, sessionCookie = cookie) =>
                  Effect.promise(() =>
                    auth.handler(
                      new Request(`${origin}/api/auth/update-user`, {
                        method: "POST",
                        headers: {
                          origin,
                          cookie: sessionCookie,
                          "content-type": "application/json",
                        },
                        body,
                      }),
                    ),
                  );
                expect((yield* update('{"locale":"en"}', "")).status).toBe(401);
                expect((yield* update('{"locale":"unsupported"}')).status).toBe(
                  400,
                );
                expect((yield* update('{"locale":"en"}')).status).toBe(200);
                const stored = yield* SqlSchema.findOne({
                  Request: Schema.String,
                  Result: LocaleUser,
                  execute: (id) =>
                    sql`SELECT id, email, locale FROM "user" WHERE id = ${id}`,
                })(user.id);
                expect(stored.locale).toBe("en");
                expect(
                  yield* resolveRecipientLocale({ email: user.email }),
                ).toBe("en");
                expect(
                  yield* resolveRecipientLocale({
                    email: `missing-${user.id}@example.com`,
                    request: new Request(origin, {
                      headers: { cookie: "locale=fr" },
                    }),
                  }),
                ).toBe("fr");
                expect(
                  yield* resolveRecipientLocale({
                    email: `missing-${user.id}@example.com`,
                  }),
                ).toBe("en");
              }),
            () =>
              sql`DELETE FROM "user" WHERE id = ${user.id}`.pipe(Effect.orDie),
          );
        }).pipe(Effect.provide(sqlTestLayer)),
    );
  },
);
