import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { vi } from "vitest";
import { sqlTestLayer } from "@/services/database";
import { createAuth } from "../config";
import { ApprovedSsoUrl, SsoIssuer, SsoDomain } from "./schema";
import { OrganizationSso, SsoDns, SsoSettingsError } from "./settings";

describe("organization SSO trust boundaries", () => {
  it("accepts approved OIDC origins and rejects internal services and ambiguous Microsoft issuers", () => {
    const valid = Schema.is(ApprovedSsoUrl);
    expect(valid("https://acme.okta.com/oauth2/default")).toBe(true);
    expect(
      valid("https://tenant.auth0.com/.well-known/openid-configuration"),
    ).toBe(true);
    for (const url of [
      "http://localhost",
      "https://127.0.0.1",
      "https://169.254.169.254",
      "https://acme.okta.com.evil.example",
      "https://user:password@acme.okta.com",
      "https://acme.okta.com:8443",
    ])
      expect(valid(url)).toBe(false);
    expect(
      Schema.is(SsoIssuer)("https://login.microsoftonline.com/common/v2.0"),
    ).toBe(false);
    expect(Schema.is(SsoDomain)("*.acme.com")).toBe(false);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "organization SSO settings",
  () => {
    it.effect(
      "isolates organizations, encrypts credentials, requires DNS proof and changes login availability without restarting auth",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* OrganizationSso;
          const id = `settings-${crypto.randomUUID()}`;
          const other = `${id}-other`;
          const owner = `${id}-owner`;
          const member = `${id}-member`;
          const outsider = `${id}-outsider`;
          const issuer = "https://acme.okta.com/oauth2/default";
          const payload = {
            organizationId: id,
            domain: `${id}.example.com`,
            issuer,
            clientId: "test-client",
            clientSecret: "PRIVATE-first-secret",
          };
          let fetchCalls = 0;
          const discovery = {
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/keys`,
            token_endpoint_auth_methods_supported: ["client_secret_post"],
          };
          vi.stubGlobal("fetch", async () => {
            fetchCalls++;
            return Response.json(discovery);
          });
          yield* Effect.gen(function* () {
            yield* sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${id}, 'Settings test', ${id}, now()), (${other}, 'Other', ${other}, now())`;
            for (const user of [owner, member, outsider])
              yield* sql`INSERT INTO "user" (id, name, email, email_verified) VALUES (${user}, 'Settings user', ${`${user}@example.com`}, true)`;
            yield* sql`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (${`${id}-o`}, ${id}, ${owner}, 'owner', now()), (${`${id}-m`}, ${id}, ${member}, 'member', now()), (${`${id}-x`}, ${other}, ${outsider}, 'owner', now())`;
            for (const userId of [member, outsider]) {
              expect(
                yield* service
                  .save({ userId, settings: payload })
                  .pipe(Effect.flip),
              ).toBeInstanceOf(SsoSettingsError);
              expect(
                yield* service
                  .get({ userId, organizationId: id })
                  .pipe(Effect.flip),
              ).toMatchObject({ status: "FORBIDDEN" });
            }
            expect(fetchCalls).toBe(0);
            const saved = yield* service.save({
              userId: owner,
              settings: payload,
            });
            expect(saved?.enabled).toBe(false);
            expect(saved?.domainVerified).toBe(false);
            expect(JSON.stringify(saved)).not.toContain(payload.clientSecret);
            const [stored] =
              yield* sql`SELECT oidc_config FROM sso_provider WHERE organization_id = ${id}`;
            expect(JSON.stringify(stored)).not.toContain(payload.clientSecret);
            expect(JSON.stringify(stored)).not.toContain(payload.clientId);
            expect(
              yield* service.discover({ email: `employee@${payload.domain}` }),
            ).toBeNull();
            expect(
              yield* service
                .setEnabled({
                  userId: owner,
                  organizationId: id,
                  enabled: true,
                })
                .pipe(Effect.flip),
            ).toMatchObject({ status: "BAD_REQUEST" });
            expect(
              yield* service
                .verify({ userId: owner, organizationId: id })
                .pipe(Effect.flip),
            ).toMatchObject({ status: "BAD_REQUEST" });
            const proofLayer = Layer.succeed(SsoDns, {
              lookup: () => Effect.succeed([saved?.verificationToken ?? ""]),
            });
            const verified = yield* OrganizationSso.make.pipe(
              Effect.provide(proofLayer),
            );
            expect(
              (yield* verified.verify({ userId: owner, organizationId: id }))
                ?.domainVerified,
            ).toBe(true);
            expect(
              (yield* service.setEnabled({
                userId: owner,
                organizationId: id,
                enabled: true,
              }))?.enabled,
            ).toBe(true);
            const otherSaved = yield* service.save({
              userId: outsider,
              settings: { ...payload, organizationId: other },
            });
            const otherVerifier = yield* OrganizationSso.make.pipe(
              Effect.provideService(SsoDns, {
                lookup: () =>
                  Effect.succeed([otherSaved?.verificationToken ?? ""]),
              }),
            );
            yield* otherVerifier.verify({
              userId: outsider,
              organizationId: other,
            });
            expect(
              yield* service
                .setEnabled({
                  userId: outsider,
                  organizationId: other,
                  enabled: true,
                })
                .pipe(Effect.flip),
            ).toMatchObject({ status: "CONFLICT" });
            const auth = createAuth({
              allowedHosts: ["localhost:3001"],
              auditRun: async () => {},
            });
            expect(
              yield* Effect.promise(() =>
                auth.api.getSsoConfig({
                  query: { email: `employee@${payload.domain}` },
                }),
              ),
            ).toEqual({ providerId: saved?.providerId });
            expect(
              yield* Effect.promise(() =>
                auth.api.getSsoConfig({ query: { organizationSlug: id } }),
              ),
            ).toEqual({ providerId: saved?.providerId });
            expect(
              yield* Effect.promise(() =>
                auth.api.getSsoConfig({ query: { organizationSlug: other } }),
              ),
            ).toBeNull();
            expect(
              yield* service
                .save({
                  userId: owner,
                  settings: {
                    ...payload,
                    issuer: "https://other.okta.com/oauth2/default",
                  },
                })
                .pipe(Effect.flip),
            ).toMatchObject({ status: "CONFLICT" });
            const rotated = yield* service.save({
              userId: owner,
              settings: { ...payload, clientSecret: "PRIVATE-rotated-secret" },
            });
            expect(rotated?.providerId).toBe(saved?.providerId);
            expect(rotated?.enabled).toBe(false);
            expect(rotated?.domainVerified).toBe(true);
            expect(
              yield* Effect.promise(() =>
                auth.api.getSsoConfig({
                  query: { email: `employee@${payload.domain}` },
                }),
              ),
            ).toBeNull();
            const withoutSecret = {
              organizationId: id,
              issuer,
              domain: payload.domain,
              clientId: payload.clientId,
            };
            expect(
              (yield* service.save({ userId: owner, settings: withoutSecret }))
                ?.providerId,
            ).toBe(saved?.providerId);

            const loginCookie = Effect.fnUntraced(function* (userId: string) {
              const email = `${userId}@example.com`;
              const otp = yield* Effect.promise(() =>
                auth.api.createVerificationOTP({
                  body: { email, type: "sign-in" },
                }),
              );
              const response = yield* Effect.promise(() =>
                auth.handler(
                  new Request(
                    "https://localhost:3001/api/auth/sign-in/email-otp",
                    {
                      method: "POST",
                      headers: {
                        origin: "https://localhost:3001",
                        "content-type": "application/json",
                      },
                      body: JSON.stringify({ email, otp }),
                    },
                  ),
                ),
              );
              expect(response.status).toBe(200);
              return response.headers
                .getSetCookie()
                .map((value) => value.split(";")[0])
                .join("; ");
            });
            const memberCookie = yield* loginCookie(member);
            const forbidden = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `https://localhost:3001/api/auth/organization/sso?organizationId=${id}`,
                  { headers: { cookie: memberCookie } },
                ),
              ),
            );
            expect(forbidden.status).toBe(403);
            const ownerCookie = yield* loginCookie(owner);
            const readable = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `https://localhost:3001/api/auth/organization/sso?organizationId=${id}`,
                  { headers: { cookie: ownerCookie } },
                ),
              ),
            );
            expect(readable.status).toBe(200);
            const readableBody = yield* Effect.promise(() => readable.text());
            expect(readableBody).not.toContain("PRIVATE-");
            expect(readableBody).toContain(
              `https://localhost:3001/api/auth/sso/callback/${saved?.providerId}`,
            );
            const unauthenticated = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `https://localhost:3001/api/auth/organization/sso?organizationId=${id}`,
                ),
              ),
            );
            expect(unauthenticated.status).toBe(401);
            const csrf = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  "https://localhost:3001/api/auth/organization/sso/enabled",
                  {
                    method: "POST",
                    headers: {
                      origin: "https://evil.example",
                      cookie: ownerCookie,
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({ organizationId: id, enabled: true }),
                  },
                ),
              ),
            );
            expect(csrf.status).toBe(403);
            yield* sql`INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (${id}, 'subject', ${saved?.providerId ?? ""}, ${member}, now())`;
            yield* sql`UPDATE member SET role = 'admin' WHERE organization_id = ${id} AND user_id = ${member}`;
            yield* sql`DELETE FROM "user" WHERE id = ${owner}`;
            expect(
              (yield* service.get({ userId: member, organizationId: id }))
                ?.providerId,
            ).toBe(saved?.providerId);
            yield* service.remove({ userId: member, organizationId: id });
            expect(yield* sql`SELECT id FROM account WHERE id = ${id}`).toEqual(
              [],
            );
            expect(
              yield* service.get({ userId: member, organizationId: id }),
            ).toBeNull();
            expect(
              yield* sql`SELECT id FROM "user" WHERE id = ${member}`,
            ).toHaveLength(1);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                vi.unstubAllGlobals();
                yield* sql`DELETE FROM "user" WHERE id IN ${sql.in([owner, member, outsider])}`;
                yield* sql`DELETE FROM organization WHERE id IN ${sql.in([id, other])}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(
            Layer.effect(OrganizationSso, OrganizationSso.make).pipe(
              Layer.provide(
                Layer.succeed(SsoDns, { lookup: () => Effect.succeed([]) }),
              ),
              Layer.provideMerge(sqlTestLayer),
            ),
          ),
        ),
      { timeout: 30_000 },
    );
  },
);
