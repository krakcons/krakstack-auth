import { describe, expect, it } from "@effect/vitest";
import { Events } from "@krak-stack/registry/events";
import {
  EventsPersistenceError,
  type TrackEvent,
} from "@krak-stack/registry/events/schema";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { vi } from "vitest";
import { symmetricEncrypt } from "better-auth/crypto";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sqlTestLayer } from "@/services/database";
import { createAuth } from "./config";

const origin = "https://localhost:3001";
const nativeRequest = (
  path: string,
  body: typeof Schema.Json.Type,
  cookie = "",
) =>
  new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: { origin, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "unauthenticated native security audit",
  () => {
    it.effect(
      "audits OTP registration only after the code is verified and never treats an email or submitted ID as an actor",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const tracked: Array<typeof TrackEvent.Type> = [];
          const recording = {
            ...events,
            track: (event: typeof TrackEvent.Type) => {
              tracked.push(event);
              return events.track(event);
            },
          };
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) =>
              Effect.runPromise(
                effect.pipe(Effect.provideService(Events, recording)),
              ),
          });
          const email = `${crypto.randomUUID()}@private.example`;
          yield* Effect.gen(function* () {
            const otp = yield* Effect.promise(() =>
              auth.api.createVerificationOTP({
                body: { email, type: "sign-in" },
              }),
            );
            const unverified = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/email-otp", {
                  email,
                  otp: "PRIVATE-invalid",
                  userId: "PRIVATE-forged-id",
                }),
              ),
            );
            expect(unverified.status).toBe(400);
            expect(tracked).toEqual([]);
            expect(
              yield* sql`SELECT id FROM "user" WHERE email = ${email}`,
            ).toEqual([]);
            const registered = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/email-otp", {
                  email,
                  otp,
                  userId: "PRIVATE-forged-id",
                }),
              ),
            );
            expect(registered.status).toBe(200);
            const result = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
            )(yield* Effect.promise(() => registered.json()));
            const outcome = tracked.at(-1);
            expect(outcome?.name).toBe("auth.user.registered");
            expect(outcome?.properties).toMatchObject({
              subjectUserId: result.user.id,
              appliedMutation: "user_created",
              sessionIssued: true,
            });
            const loginOtp = yield* Effect.promise(() =>
              auth.api.createVerificationOTP({
                body: { email, type: "sign-in" },
              }),
            );
            const signedIn = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/email-otp", { email, otp: loginOtp }),
              ),
            );
            expect(signedIn.status).toBe(200);
            expect(tracked).toHaveLength(2);
            expect(tracked[1]?.name).toBe("auth.session.signed_in");
            expect(tracked[1]?.properties).toMatchObject({
              subjectUserId: result.user.id,
              sessionIssued: true,
            });
            for (const event of tracked) {
              const rows =
                yield* sql`SELECT user_id, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`} AND event_name = ${event.name}`;
              expect(rows).toHaveLength(1);
              expect(rows[0]?.userId).toBe(result.user.id);
              expect(rows[0]?.payload).not.toMatch(/PRIVATE-|private.example/);
              expect(rows[0]?.payload).not.toContain(otp);
              expect(rows[0]?.payload).not.toContain(loginOtp);
            }
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                const users =
                  yield* sql`SELECT id FROM "user" WHERE email = ${email}`;
                for (const user of users) {
                  yield* sql`DELETE FROM organization WHERE user_id = ${user.id}`;
                  yield* sql`DELETE FROM "user" WHERE id = ${user.id}`;
                }
                yield* sql`DELETE FROM verification WHERE identifier LIKE ${`%${email}%`}`;
                for (const event of tracked)
                  yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );
    it.effect(
      "audits token-only password resets under a system actor and takes subjects only from the verified reset callback",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const tracked: Array<typeof TrackEvent.Type> = [];
          const recording = {
            ...events,
            track: (event: typeof TrackEvent.Type) => {
              tracked.push(event);
              return events.track(event);
            },
          };
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) =>
              Effect.runPromise(
                effect.pipe(Effect.provideService(Events, recording)),
              ),
          });
          const context = yield* Effect.promise(() => auth.$context);
          const id = crypto.randomUUID();
          const token = `PRIVATE-reset-${crypto.randomUUID()}`;
          const oldSessionToken = `PRIVATE-session-${crypto.randomUUID()}`;
          yield* sql`INSERT INTO "user" (id, name, email, email_verified) VALUES (${id}, 'PRIVATE-name', ${`${id}@private.example`}, true)`;
          yield* sql`INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (${id}, ${oldSessionToken}, ${id}, ${new Date(Date.now() + 60_000)}, now(), now())`;
          yield* Effect.gen(function* () {
            yield* Effect.promise(() =>
              context.internalAdapter.createVerificationValue({
                identifier: `reset-password:${token}`,
                value: id,
                expiresAt: new Date(Date.now() + 60_000),
              }),
            );
            const invalid = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/reset-password", {
                  token: "PRIVATE-invalid",
                  newPassword: "PRIVATE-new-password",
                  userId: id,
                  email: `${id}@private.example`,
                }),
              ),
            );
            expect(invalid.status).toBe(400);
            const invalidBody = yield* Effect.promise(() => invalid.json());
            expect(tracked).toEqual([]);
            const reset = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/reset-password", {
                  token,
                  newPassword: "PRIVATE-new-password",
                }),
              ),
            );
            expect(reset.status).toBe(200);
            const completed = tracked.at(-1);
            expect(completed?.name).toBe("auth.password.reset");
            expect(completed?.properties).toMatchObject({
              subjectUserId: id,
              appliedMutation: "password_reset",
              sessionIssued: false,
            });
            expect(tracked).toHaveLength(1);
            expect(
              yield* sql`SELECT id FROM session WHERE user_id = ${id}`,
            ).toEqual([]);
            const credential = yield* Effect.promise(() =>
              context.internalAdapter.findCredentialAccount(id),
            );
            if (!credential?.password)
              return yield* Effect.die(
                "Password reset did not persist a credential",
              );
            expect(
              yield* Effect.promise(() =>
                context.password.verify({
                  hash: credential.password!,
                  password: "PRIVATE-new-password",
                }),
              ),
            ).toBe(true);
            const replay = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/reset-password", {
                  token,
                  newPassword: "PRIVATE-other-password",
                  userId: id,
                }),
              ),
            );
            expect(replay.status).toBe(400);
            expect(yield* Effect.promise(() => replay.json())).toEqual(
              invalidBody,
            );
            expect(tracked).toHaveLength(1);
            for (const event of tracked) {
              const rows =
                yield* sql`SELECT user_id, organization_id, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`} AND event_name = ${event.name}`;
              expect(rows).toHaveLength(1);
              expect(rows[0]?.userId).toBeNull();
              expect(rows[0]?.organizationId).toBe(
                process.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID,
              );
              expect(rows[0]?.payload).toContain('"system"');
              expect(rows[0]?.payload).toContain('"better-auth"');
              expect(rows[0]?.payload).not.toMatch(/PRIVATE-|private.example/);
              expect(rows[0]?.payload).not.toContain(credential.password);
            }
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
                yield* sql`DELETE FROM verification WHERE value = ${id}`;
                for (const event of tracked)
                  yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );

    it.effect(
      "does not gate reset on audit storage and still revokes sessions when its success audit fails",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const tracked: Array<typeof TrackEvent.Type> = [];
          const recording = {
            ...events,
            track: (event: typeof TrackEvent.Type) => {
              tracked.push(event);
              if (event.name === "auth.password.reset")
                return Effect.fail(
                  new EventsPersistenceError({
                    operation: "test boundary rejection",
                  }),
                );
              return events.track(event);
            },
          };
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) =>
              Effect.runPromise(
                effect.pipe(Effect.provideService(Events, recording)),
              ),
          });
          const context = yield* Effect.promise(() => auth.$context);
          const id = crypto.randomUUID();
          const token = `PRIVATE-reset-${crypto.randomUUID()}`;
          yield* sql`INSERT INTO "user" (id, name, email, email_verified) VALUES (${id}, 'PRIVATE-name', ${`${id}@private.example`}, true)`;
          yield* sql`INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (${id}, ${id}, ${id}, ${new Date(Date.now() + 60_000)}, now(), now())`;
          yield* Effect.gen(function* () {
            yield* Effect.promise(() =>
              context.internalAdapter.createVerificationValue({
                identifier: `reset-password:${token}`,
                value: id,
                expiresAt: new Date(Date.now() + 60_000),
              }),
            );
            const rejectedInvalid = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/reset-password", {
                  token: "PRIVATE-invalid",
                  newPassword: "PRIVATE-new-password",
                }),
              ),
            );
            expect(rejectedInvalid.status).toBe(400);
            expect(tracked).toEqual([]);
            expect(
              yield* Effect.promise(() =>
                context.internalAdapter.findVerificationValue(
                  `reset-password:${token}`,
                ),
              ),
            ).not.toBeNull();
            expect(
              yield* Effect.promise(() =>
                context.internalAdapter.findCredentialAccount(id),
              ),
            ).toBeNull();
            expect(
              yield* sql`SELECT id FROM session WHERE user_id = ${id}`,
            ).toHaveLength(1);
            const completedWithoutReceipt = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/reset-password", {
                  token,
                  newPassword: "PRIVATE-new-password",
                }),
              ),
            );
            expect(completedWithoutReceipt.status).toBe(500);
            expect(
              yield* sql`SELECT id FROM session WHERE user_id = ${id}`,
            ).toEqual([]);
            expect(
              yield* Effect.promise(() =>
                context.internalAdapter.findVerificationValue(
                  `reset-password:${token}`,
                ),
              ),
            ).toBeNull();
            const credential = yield* Effect.promise(() =>
              context.internalAdapter.findCredentialAccount(id),
            );
            expect(credential?.password).toBeTruthy();
            expect(tracked).toHaveLength(1);
            expect(tracked[0]?.name).toBe("auth.password.reset");
            expect(tracked.at(-1)?.properties?.appliedMutation).toBe(
              "password_reset",
            );
            const persisted =
              yield* sql`SELECT event_name FROM events WHERE payload_json::text LIKE ${`%${tracked[0]?.properties?.operationId}%`}`;
            expect(persisted).toEqual([]);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
                yield* sql`DELETE FROM verification WHERE value = ${id}`;
                for (const event of tracked)
                  yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );

    it.effect(
      "audits OAuth registration and issued sessions only after verified state/provider resolution, not from callback or synthetic response data",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const tracked: Array<typeof TrackEvent.Type> = [];
          const recording = {
            ...events,
            track: (event: typeof TrackEvent.Type) => {
              tracked.push(event);
              return events.track(event);
            },
          };
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) =>
              Effect.runPromise(
                effect.pipe(Effect.provideService(Events, recording)),
              ),
          });
          const context = yield* Effect.promise(() => auth.$context);
          const id = crypto.randomUUID();
          const email = `${id}@private.example`;
          let validatedCodes = 0;
          const diagnostics = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});
          context.socialProviders.push({
            id: "audit-test",
            name: "Audit provider",
            accountSubject: () => id,
            createAuthorizationURL: async ({ state }) =>
              new URL(
                `https://private-provider.example/authorize?state=${state}`,
              ),
            validateAuthorizationCode: async ({ code }) => {
              if (code !== "PRIVATE-valid-code")
                throw new Error("Rejected code");
              validatedCodes++;
              return {
                accessToken: "PRIVATE-provider-token",
                scopes: ["openid", "email"],
              };
            },
            getUserInfo: async () => ({
              user: {
                email,
                name: "PRIVATE-provider-name",
                emailVerified: true,
              },
              data: {},
            }),
          });
          yield* Effect.gen(function* () {
            const unverified = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `${origin}/api/auth/callback/audit-test?code=PRIVATE-valid-code&state=PRIVATE-invalid&user=${encodeURIComponent(JSON.stringify({ id, email }))}`,
                ),
              ),
            );
            expect(unverified.status).toBe(302);
            expect(validatedCodes).toBe(0);
            expect(tracked).toEqual([]);
            const start = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/social", {
                  provider: "audit-test",
                  callbackURL: `${origin}/after`,
                  disableRedirect: true,
                }),
              ),
            );
            expect(start.status).toBe(200);
            expect(tracked).toEqual([]);
            const authorization = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ url: Schema.String }),
            )(yield* Effect.promise(() => start.json()));
            const state = new URL(authorization.url).searchParams.get("state");
            expect(state).toBeTruthy();
            const cookie = start.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            const callbackURL = `${origin}/api/auth/callback/audit-test?code=PRIVATE-valid-code&state=${state}&user=${encodeURIComponent(JSON.stringify({ id: "PRIVATE-forged-id", email: "PRIVATE-forged@example.test" }))}`;
            const callback = yield* Effect.promise(() =>
              auth.handler(new Request(callbackURL, { headers: { cookie } })),
            );
            expect(callback.status).toBe(302);
            expect(validatedCodes).toBe(1);
            const stored =
              yield* sql`SELECT id FROM "user" WHERE email = ${email}`;
            expect(stored).toHaveLength(1);
            const userId = stored[0]?.id;
            const completed = tracked.at(-1);
            expect(completed?.name).toBe("auth.user.registered");
            expect(completed?.properties).toMatchObject({
              subjectUserId: userId,
              sessionIssued: true,
              appliedMutation: "user_created",
            });
            expect(
              yield* sql`SELECT id FROM session WHERE id = ${completed?.properties?.issuedSessionId}`,
            ).toHaveLength(1);
            const replay = yield* Effect.promise(() =>
              auth.handler(new Request(callbackURL, { headers: { cookie } })),
            );
            expect(replay.status).toBe(302);
            expect(tracked).toHaveLength(1);
            // This app disables password signup. Exercise BA's synthetic duplicate
            // response separately to guard against trusting returned user.id.
            if (!context.options.emailAndPassword)
              return yield* Effect.die("Password options missing");
            Object.assign(context.options.emailAndPassword, {
              disableSignUp: false,
            });
            const duplicate = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-up/email", {
                  email,
                  name: "PRIVATE-duplicate",
                  password: "PRIVATE-duplicate-password",
                  userId: "PRIVATE-forged-id",
                }),
              ),
            );
            expect(duplicate.status).toBe(200);
            expect(tracked).toHaveLength(1);
            expect(tracked[0]).toBe(completed);
            const loginStart = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/social", {
                  provider: "audit-test",
                  callbackURL: `${origin}/after`,
                  disableRedirect: true,
                }),
              ),
            );
            expect(loginStart.status).toBe(200);
            expect(tracked).toHaveLength(1);
            const loginAuthorization = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ url: Schema.String }).annotate({
                identifier: "NativeOAuthLoginStart",
              }),
            )(yield* Effect.promise(() => loginStart.json()));
            const loginState = new URL(loginAuthorization.url).searchParams.get(
              "state",
            );
            const loginCookie = loginStart.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            const loginCallback = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `${origin}/api/auth/callback/audit-test?code=PRIVATE-valid-code&state=${loginState}`,
                  { headers: { cookie: loginCookie } },
                ),
              ),
            );
            expect(loginCallback.status).toBe(302);
            expect(validatedCodes).toBe(2);
            expect(tracked).toHaveLength(2);
            expect(tracked[1]?.name).toBe("auth.session.signed_in");
            expect(tracked[1]?.properties).toMatchObject({
              subjectUserId: userId,
              sessionIssued: true,
            });
            for (const event of tracked) {
              expect(JSON.stringify(event)).not.toMatch(
                /PRIVATE-|private.example|private-provider.example|callback\/audit-test/,
              );
              const rows =
                yield* sql`SELECT user_id, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`} AND event_name = ${event.name}`;
              expect(rows[0]?.userId).toBe(userId);
              expect(rows[0]?.payload).not.toMatch(
                /PRIVATE-|private.example|private-provider.example/,
              );
              expect(rows[0]?.payload).not.toContain(state);
              expect(rows[0]?.payload).not.toContain(loginState);
            }
            expect(JSON.stringify(diagnostics.mock.calls)).not.toMatch(
              /PRIVATE-|private.example|private-provider.example/,
            );
            expect(JSON.stringify(diagnostics.mock.calls)).not.toContain(state);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                diagnostics.mockRestore();
                const users =
                  yield* sql`SELECT id FROM "user" WHERE email = ${email}`;
                for (const user of users) {
                  yield* sql`DELETE FROM organization WHERE user_id = ${user.id}`;
                  yield* sql`DELETE FROM "user" WHERE id = ${user.id}`;
                }
                for (const event of tracked)
                  yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );

    it.effect(
      "audits two-factor login only after verification, not wrong passwords, rejected codes or pending challenges",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const tracked: Array<typeof TrackEvent.Type> = [];
          const recording = {
            ...events,
            track: (event: typeof TrackEvent.Type) => {
              tracked.push(event);
              return events.track(event);
            },
          };
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) =>
              Effect.runPromise(
                effect.pipe(Effect.provideService(Events, recording)),
              ),
          });
          const context = yield* Effect.promise(() => auth.$context);
          const id = crypto.randomUUID();
          const email = `${id}@private.example`;
          yield* sql`INSERT INTO "user" (id, name, email, email_verified, two_factor_enabled) VALUES (${id}, 'PRIVATE-name', ${email}, true, true)`;
          yield* Effect.gen(function* () {
            const backupCode = "PRIVATE-backup-code";
            const encryptedCodes = yield* Effect.promise(() =>
              symmetricEncrypt({
                key: context.secretConfig,
                data: JSON.stringify([backupCode]),
              }),
            );
            const encryptedSecret = yield* Effect.promise(() =>
              symmetricEncrypt({
                key: context.secretConfig,
                data: "PRIVATE-totp-secret",
              }),
            );
            yield* Effect.promise(() =>
              context.adapter.create({
                model: "twoFactor",
                data: {
                  userId: id,
                  secret: encryptedSecret,
                  backupCodes: encryptedCodes,
                  verified: true,
                },
              }),
            );
            const password = "PRIVATE-factor-password";
            const hash = yield* Effect.promise(() =>
              context.password.hash(password),
            );
            yield* Effect.promise(() =>
              context.internalAdapter.createAccount({
                userId: id,
                accountId: id,
                providerId: "credential",
                password: hash,
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            );
            const invalid = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/email", {
                  email,
                  password: "PRIVATE-wrong-password",
                  userId: id,
                }),
              ),
            );
            expect(invalid.status).toBe(401);
            expect(tracked).toEqual([]);
            const response = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest("/sign-in/email", {
                  email,
                  password,
                  userId: "PRIVATE-forged-id",
                }),
              ),
            );
            expect(response.status).toBe(200);
            const challenge = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ twoFactorRedirect: Schema.Boolean }),
            )(yield* Effect.promise(() => response.json()));
            expect(challenge.twoFactorRedirect).toBe(true);
            expect(tracked).toEqual([]);
            expect(
              yield* sql`SELECT id FROM session WHERE user_id = ${id}`,
            ).toEqual([]);
            const rows =
              yield* sql`SELECT event_name FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
            expect(rows).toEqual([]);
            const cookie = response.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            const rejectedCode = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest(
                  "/two-factor/verify-backup-code",
                  { code: "PRIVATE-forged-code", userId: id },
                  cookie,
                ),
              ),
            );
            expect(rejectedCode.status).toBe(401);
            expect(tracked).toEqual([]);
            const verified = yield* Effect.promise(() =>
              auth.handler(
                nativeRequest(
                  "/two-factor/verify-backup-code",
                  { code: backupCode },
                  cookie,
                ),
              ),
            );
            expect(verified.status).toBe(200);
            expect(tracked).toHaveLength(1);
            expect(tracked[0]?.name).toBe("auth.session.signed_in");
            expect(tracked[0]?.properties).toMatchObject({
              subjectUserId: id,
              sessionIssued: true,
            });
            expect(
              yield* sql`SELECT id FROM session WHERE user_id = ${id}`,
            ).toHaveLength(1);
            const persisted =
              yield* sql`SELECT user_id, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${tracked[0]?.properties?.operationId}%`}`;
            expect(persisted).toHaveLength(1);
            expect(persisted[0]?.userId).toBe(id);
            expect(persisted[0]?.payload).not.toMatch(
              /PRIVATE-|private.example/,
            );
            expect(persisted[0]?.payload).not.toContain(cookie);
            expect(persisted[0]?.payload).not.toContain(encryptedCodes);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM organization WHERE user_id = ${id}`;
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
                yield* sql`DELETE FROM verification WHERE value = ${id}`;
                for (const event of tracked)
                  yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${event.properties?.operationId}%`}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(testEventsLayer), Effect.provide(sqlTestLayer)),
    );
  },
);
