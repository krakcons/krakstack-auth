import { describe, expect, it } from "@effect/vitest";
import { Effect, ManagedRuntime, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { sqlTestLayer } from "@/services/database";
import { testEventsLayer } from "@/services/audit/test-layer";
import { createAuth } from "./config";
import { symmetricDecrypt } from "better-auth/crypto";
import { BetterAuthRequest } from "./better-auth-request";
import { Organizations } from "@/services/organizations";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "native Better Auth audit hooks",
  () => {
    it.effect(
      "audits successful native actions once, omits denials, and never persists secrets or PII",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const runtime = ManagedRuntime.make(testEventsLayer);
          const id = crypto.randomUUID();
          const email = `${id}@example.test`;
          const password = "PRIVATE-test-password-123";
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) => runtime.runPromise(effect),
          });
          const context = yield* Effect.promise(() => auth.$context);
          const now = new Date();
          yield* Effect.promise(() =>
            context.adapter.create({
              model: "user",
              data: {
                id,
                name: "PRIVATE-original",
                email,
                emailVerified: true,
                role: "user",
                createdAt: now,
                updatedAt: now,
              },
              forceAllowId: true,
            }),
          );
          yield* Effect.gen(function* () {
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
            const signIn = yield* Effect.promise(() =>
              auth.api.signInEmail({
                request: new Request(
                  "https://localhost:3001/api/auth/sign-in/email",
                ),
                body: { email, password },
                returnHeaders: true,
              }),
            );
            const cookie = signIn.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            expect(cookie).toBeTruthy();
            const signedInAudit =
              yield* sql`SELECT user_id, payload_json FROM events
              WHERE event_name = 'auth.session.signed_in' AND user_id = ${id}`;
            expect(signedInAudit).toHaveLength(1);
            expect(signedInAudit[0]?.payloadJson).toMatchObject({
              resourceLogs: [
                {
                  scopeLogs: [
                    {
                      logRecords: [
                        {
                          attributes: expect.arrayContaining([
                            {
                              key: "app.actor.type",
                              value: { stringValue: "user" },
                            },
                            { key: "app.actor.id", value: { stringValue: id } },
                          ]),
                        },
                      ],
                    },
                  ],
                },
              ],
            });
            expect(
              signIn.headers.getSetCookie().map((value) => value.split("=")[0]),
            ).toContain(context.authCookies.sessionToken.name);
            // Real native handler, not an HttpApi wrapper.
            const updated = yield* Effect.promise(() =>
              auth.handler(
                new Request("https://localhost:3001/api/auth/update-user", {
                  method: "POST",
                  headers: {
                    cookie,
                    origin: "https://localhost:3001",
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ name: "PRIVATE-updated" }),
                }),
              ),
            );
            expect(updated.status).toBe(200);
            const denied = yield* Effect.promise(() =>
              auth.handler(
                new Request("https://localhost:3001/api/auth/admin/set-role", {
                  method: "POST",
                  headers: {
                    cookie,
                    origin: "https://localhost:3001",
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ userId: id, role: "admin" }),
                }),
              ),
            );
            expect(denied.status).toBe(403);
            const native = (
              path: string,
              body: typeof Schema.Json.Type,
              requestCookie = cookie,
            ) =>
              auth.handler(
                new Request(`https://localhost:3001/api/auth${path}`, {
                  method: "POST",
                  headers: {
                    cookie: requestCookie,
                    origin: "https://localhost:3001",
                    "content-type": "application/json",
                  },
                  body: JSON.stringify(body),
                }),
              );
            const key = yield* Effect.promise(() =>
              native("/api-key/create", {
                configId: "user",
                name: "PRIVATE-key",
              }),
            );
            expect(key.status).toBe(200);
            const organization = yield* Effect.promise(() =>
              native("/organization/create", {
                name: "PRIVATE-org",
                slug: `audit-${id}`,
              }),
            );
            expect(organization.status).toBe(200);
            const created = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ id: Schema.String }),
            )(yield* Effect.promise(() => organization.json()));
            const invitation = yield* Effect.promise(() =>
              native("/organization/invite-member", {
                organizationId: created.id,
                email: `PRIVATE-invite-${id}@example.test`,
                role: "member",
              }),
            );
            expect(invitation.status).toBe(200);
            // The app action owns its audit. Its direct BA implementation step
            // must not add a second native success event. The native
            // HTTP create above must still be audited.
            const appRequest = new Request(
              "https://localhost:3001/api/admin/organizations",
              {
                headers: {
                  cookie,
                  host: "localhost:3001",
                  origin: "https://localhost:3001",
                },
              },
            );
            const appOrganization = yield* Effect.promise(() =>
              runtime.runPromise(
                Effect.flatMap(Organizations.make, (organizations) =>
                  organizations.create({
                    payload: {
                      name: "PRIVATE-app-org",
                      slug: `audit-app-${id}`,
                    },
                  }),
                ).pipe(
                  Effect.provideService(BetterAuthRequest, {
                    auth,
                    request: appRequest,
                    headers: appRequest.headers,
                    api: auth.api,
                    handler: auth.handler,
                  }),
                  Effect.annotateLogs({
                    "app.actor.type": "user",
                    "app.actor.id": id,
                    "user.id": id,
                    "organization.id":
                      process.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID!,
                  }),
                ),
              ),
            );
            expect(
              yield* sql`SELECT id FROM organization WHERE id = ${appOrganization.id}`,
            ).toHaveLength(1);
            expect(
              (yield* sql`SELECT event_name FROM events WHERE payload_json::text LIKE ${`%${appOrganization.id}%`} AND event_name LIKE 'organization.%'`).map(
                (row) => row.eventName,
              ),
            ).toEqual(["organization.created"]);
            // A read with potential provider-token bookkeeping has no audit
            // dependency, even when the read is rejected by Better Auth.
            const profile = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  "https://localhost:3001/api/auth/account-info?providerId=missing",
                  { headers: { cookie } },
                ),
              ),
            );
            expect(profile.status).toBe(400);
            const setup = yield* Effect.promise(() =>
              native("/two-factor/enable", { password }),
            );
            expect(setup.status).toBe(200);
            const setupData = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ secret: Schema.String }).annotate({
                identifier: "NativeFactorSetup",
              }),
            )(
              yield* Effect.promise(() =>
                context.adapter.findOne({
                  model: "twoFactor",
                  where: [{ field: "userId", value: id }],
                }),
              ),
            );
            // generateTOTP expects BA's raw secret, not the base32-encoded URI
            // representation consumed by authenticator applications.
            const factorSecret = yield* Effect.promise(() =>
              symmetricDecrypt({
                key: context.secretConfig,
                data: setupData.secret,
              }),
            );
            const token = yield* Effect.promise(() =>
              auth.handler(
                new Request("https://localhost:3001/api/auth/token", {
                  headers: { cookie },
                }),
              ),
            );
            expect(token.status).toBe(200);
            // Default BA setup only hands back a secret/challenge; the factor
            // is not enabled until it is verified. Do not audit an enable yet.
            expect(
              yield* sql`SELECT two_factor_enabled FROM "user" WHERE id = ${id}`,
            ).toEqual([{ twoFactorEnabled: false }]);
            const anonymous = yield* Effect.promise(() =>
              auth.handler(
                new Request("http://localhost:3001/api/auth/update-user", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    origin: "http://localhost:3001",
                  },
                  body: JSON.stringify({ name: "PRIVATE-forged", userId: id }),
                }),
              ),
            );
            expect(anonymous.status).toBe(401);
            const events =
              yield* sql`SELECT event_name, organization_id, payload_json::text AS payload FROM events WHERE payload_json::text LIKE ${`%${id}%`} AND event_name LIKE 'auth.%'`;
            expect(events.map((row) => row.eventName).sort()).toEqual([
              "auth.api_key.created",
              "auth.invitation.created",
              "auth.organization.created",
              "auth.session.signed_in",
              "auth.user.updated",
            ]);
            for (const event of events) {
              expect(event.organizationId).toBe(
                process.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID,
              );
              expect(event.payload).toContain(id);
              expect(event.payload).not.toMatch(
                /PRIVATE-|example.test|session_token/,
              );
              expect(event.payload).not.toContain(hash);
              expect(event.payload).not.toContain(cookie);
            }
            expect(
              yield* sql`SELECT role, name FROM "user" WHERE id = ${id}`,
            ).toEqual([{ role: "user", name: "PRIVATE-updated" }]);
            const constraint = `reject_native_success_${id.replaceAll("-", "")}`;
            yield* sql`ALTER TABLE events ADD CONSTRAINT ${sql(constraint)} CHECK (event_name <> 'auth.user.updated') NOT VALID`;
            yield* Effect.gen(function* () {
              const rejected = yield* Effect.tryPromise({
                try: () =>
                  native("/update-user", { name: "PRIVATE-already-applied" }),
                catch: (error) => error,
              }).pipe(Effect.result);
              if (rejected._tag === "Success")
                expect(rejected.success.status).toBe(500);
              expect(
                yield* sql`SELECT name FROM "user" WHERE id = ${id}`,
              ).toEqual([{ name: "PRIVATE-already-applied" }]);
            }).pipe(
              Effect.ensuring(
                sql`ALTER TABLE events DROP CONSTRAINT ${sql(constraint)}`.pipe(
                  Effect.orDie,
                ),
              ),
            );
            const totp = yield* Effect.promise(() =>
              auth.api.generateTOTP({
                headers: { host: "localhost:3001" },
                body: { secret: factorSecret },
              }),
            );
            const verifiedFactor = yield* Effect.promise(() =>
              native("/two-factor/verify-totp", { code: totp.code }),
            );
            expect(verifiedFactor.status).toBe(200);
            const enabled =
              yield* sql`SELECT payload_json::text AS payload FROM events WHERE event_name = 'auth.two_factor.enabled' AND user_id = ${id}`;
            expect(enabled).toHaveLength(1);
            expect(enabled[0]?.payload).not.toContain(factorSecret);
            expect(enabled[0]?.payload).not.toContain(totp.code);
            expect(
              yield* sql`SELECT event_name FROM events WHERE event_name = 'auth.session.signed_in' AND payload_json::text LIKE ${`%${id}%`}`,
            ).toHaveLength(1);
            const verifiedCookie = verifiedFactor.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            const signOut = yield* Effect.promise(() =>
              native("/sign-out", {}, verifiedCookie),
            );
            expect(signOut.status).toBe(200);
            expect(
              yield* sql`SELECT id FROM session WHERE user_id = ${id}`,
            ).toEqual([]);
            const revocation =
              yield* sql`SELECT payload_json::text AS payload FROM events WHERE event_name = 'auth.session.signed_out' AND user_id = ${id}`;
            expect(revocation).toHaveLength(1);
            expect(revocation[0]?.payload).toContain("session_revoked");
            expect(revocation[0]?.payload).not.toContain(cookie);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM organization WHERE user_id = ${id} OR slug IN (${`audit-${id}`}, ${`audit-app-${id}`})`;
                yield* sql`DELETE FROM apikey WHERE reference_id = ${id}`;
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
                yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
                yield* Effect.promise(() => runtime.dispose());
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(sqlTestLayer)),
    );
  },
);
