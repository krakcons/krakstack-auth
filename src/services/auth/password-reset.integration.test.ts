import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

import { sqlTestLayer } from "@/services/database";
import { createAuth } from "./config";

describe.skipIf(!process.env.TEST_DATABASE_URL)("password reset email", () => {
  it.effect(
    "hands off a usable reset link and resets an OTP-only account without its old password",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const userId = `reset-${crypto.randomUUID()}`;
        const email = `${userId}@example.com`;
        const auth = createAuth({ allowedHosts: ["localhost:3001"] });
        const context = yield* Effect.promise(() => auth.$context);
        const now = new Date();
        const deliveries: Array<{ to: string; url: string }> = [];
        const emailAndPassword = context.options.emailAndPassword;
        if (!emailAndPassword?.sendResetPassword) {
          return yield* Effect.die("Password reset email sender is missing");
        }
        const sendResetPassword = emailAndPassword.sendResetPassword;
        emailAndPassword.sendResetPassword = async (input, request) => {
          // Use the real email renderer and the project's test notification layer.
          // Capture the handoff without delivering email to an external inbox.
          await sendResetPassword(input, request);
          deliveries.push({ to: input.user.email, url: input.url });
        };

        yield* Effect.acquireUseRelease(
          Effect.promise(() =>
            context.adapter.create({
              model: "user",
              data: {
                id: userId,
                name: "Password reset",
                email,
                emailVerified: true,
                createdAt: now,
                updatedAt: now,
              },
              forceAllowId: true,
            }),
          ),
          () =>
            Effect.gen(function* () {
              yield* Effect.promise(() =>
                context.adapter.create({
                  model: "session",
                  data: {
                    id: userId,
                    token: userId,
                    userId,
                    expiresAt: new Date(Date.now() + 60_000),
                    createdAt: now,
                    updatedAt: now,
                  },
                  forceAllowId: true,
                }),
              );
              const response = yield* Effect.promise(() =>
                auth.api.requestPasswordReset({
                  body: { email, redirectTo: "/reset-password" },
                }),
              );
              expect(response.status).toBe(true);
              expect(deliveries).toHaveLength(1);
              const sent = deliveries[0]!;
              expect(sent.to).toBe(email);
              const resetUrl = new URL(sent.url);
              expect(resetUrl.pathname).toMatch(
                /^\/api\/auth\/reset-password\//,
              );
              expect(resetUrl.searchParams.get("callbackURL")).toBe(
                "/reset-password",
              );
              const token = resetUrl.pathname.split("/").at(-1)!;

              yield* Effect.promise(() =>
                auth.api.resetPassword({
                  body: { token, newPassword: "reset-test-password" },
                }),
              );
              expect(
                yield* Effect.promise(() =>
                  context.internalAdapter.findSession(userId),
                ),
              ).toBeNull();
              const credential = yield* Effect.promise(() =>
                context.internalAdapter.findCredentialAccount(userId),
              );
              expect(credential?.password).toBeTruthy();
              expect(
                yield* Effect.promise(() =>
                  context.password.verify({
                    hash: credential!.password!,
                    password: "reset-test-password",
                  }),
                ),
              ).toBe(true);
              yield* Effect.promise(() =>
                expect(
                  auth.api.resetPassword({
                    body: { token, newPassword: "another-password" },
                  }),
                ).rejects.toThrow(),
              );
            }),
          () => sql`DELETE FROM "user" WHERE id = ${userId}`.pipe(Effect.orDie),
        );
      }).pipe(Effect.provide(sqlTestLayer)),
  );
});
