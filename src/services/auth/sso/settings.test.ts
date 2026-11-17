import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { vi } from "vitest";
import { discoverOIDCConfig } from "@better-auth/sso";
import { OrganizationSsoConnection } from "@krak-stack/auth/auth";
import { sqlTestLayer } from "@/services/database";
import { createAuth } from "../config";
import {
  ApprovedSsoUrl,
  SsoIssuer,
  SsoDomain,
  SsoOidcConfiguration,
  ssoIdpOrigins,
  SsoSettingsBody,
  SsoClientId,
} from "./schema";
import { OrganizationSso, SsoSettingsError } from "./settings";

const dnsLookup = vi.hoisted(() => vi.fn<() => Promise<string[][]>>());
// oxlint-disable-next-line anti-slop/no-module-mocking -- The third-party verifier imports DNS directly and exposes no resolver injection; keep its challenge and verification logic real.
vi.mock("node:dns/promises", () => ({ resolveTxt: dnsLookup }));

describe("organization SSO trust boundaries", () => {
  it("trims client IDs and rejects whitespace-only values", () => {
    expect(Schema.decodeSync(SsoClientId)("  google-client-id \n")).toBe(
      "google-client-id",
    );
    expect(() => Schema.decodeSync(SsoClientId)(" \n ")).toThrow();
  });
  it("decodes blank-secret JSON requests without accepting invalid secrets", async () => {
    const body = Schema.toStandardSchemaV1(SsoSettingsBody);
    const settings = {
      organizationId: "test-organization",
      issuer: "https://accounts.google.com",
      domain: "example.com",
      clientId: "test-client",
    };
    for (const input of [settings, { ...settings, clientSecret: null }]) {
      expect(await body["~standard"].validate(input)).toEqual({
        value: { ...settings, clientSecret: undefined },
      });
    }
    for (const clientSecret of ["", 42]) {
      expect(
        await body["~standard"].validate({ ...settings, clientSecret }),
      ).toHaveProperty("issues");
    }
    expect(
      await body["~standard"].validate({
        ...settings,
        clientSecret: "replacement-secret",
      }),
    ).toEqual({ value: { ...settings, clientSecret: "replacement-secret" } });
  });
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
      "https://www.googleapis.com.evil.example/oauth2/v3/certs",
    ])
      expect(valid(url)).toBe(false);
    expect(
      Schema.is(SsoIssuer)("https://login.microsoftonline.com/common/v2.0"),
    ).toBe(false);
    expect(Schema.is(SsoDomain)("*.acme.com")).toBe(false);
  });

  it.effect(
    "accepts Google's discovered signing-key and UserInfo endpoints",
    () =>
      Effect.gen(function* () {
        const issuer = "https://accounts.google.com";
        // Google publishes its signing keys on a different origin from its issuer,
        // token and UserInfo endpoints.
        const discovery = {
          issuer,
          authorization_endpoint: `${issuer}/o/oauth2/v2/auth`,
          token_endpoint: "https://oauth2.googleapis.com/token",
          userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
          jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
          token_endpoint_auth_methods_supported: [
            "client_secret_post",
            "client_secret_basic",
          ],
          response_types_supported: ["code", "token", "id_token"],
          scopes_supported: ["openid", "email", "profile"],
        };
        vi.stubGlobal(
          "fetch",
          async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(new Request(input, init).url).toBe(
              `${issuer}/.well-known/openid-configuration`,
            );
            return Response.json(discovery);
          },
        );
        const discovered = yield* Effect.promise(() =>
          discoverOIDCConfig({
            issuer,
            isTrustedOrigin: Schema.is(ApprovedSsoUrl),
          }),
        );
        const config = yield* Schema.decodeUnknownEffect(SsoOidcConfiguration)({
          ...discovered,
          issuer,
          clientId: "google-test-client",
          clientSecret: "test-only-secret",
          discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
          pkce: true,
          scopes: ["openid", "email", "profile"],
        });
        expect(config.jwksEndpoint).toBe(discovery.jwks_uri);
        expect(config.userInfoEndpoint).toBe(discovery.userinfo_endpoint);
        expect(ssoIdpOrigins).toContain(new URL(config.jwksEndpoint).origin);
      }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllGlobals()))),
  );
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
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: async () => {},
          });
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
          dnsLookup.mockResolvedValue([]);
          const headersFor = (cookie: string) =>
            new Headers({
              origin: "https://localhost:3001",
              cookie,
            });
          const challengeIdentifiers = new Set<string>();
          const settingsRequest = (
            cookie: string,
            organizationId: string,
            verify = false,
          ) =>
            auth.handler(
              new Request(
                verify
                  ? "https://localhost:3001/api/auth/organization/sso/verify"
                  : `https://localhost:3001/api/auth/organization/sso?organizationId=${organizationId}`,
                {
                  method: verify ? "POST" : "GET",
                  headers: {
                    ...Object.fromEntries(headersFor(cookie)),
                    "content-type": "application/json",
                  },
                  body: verify ? JSON.stringify({ organizationId }) : undefined,
                },
              ),
            );
          const readSettings = Effect.fnUntraced(function* (
            cookie: string,
            organizationId: string,
          ) {
            const response = yield* Effect.promise(() =>
              settingsRequest(cookie, organizationId),
            );
            expect(response.status).toBe(200);
            const connection = yield* Schema.decodeUnknownEffect(
              Schema.NullOr(OrganizationSsoConnection),
            )(yield* Effect.promise(() => response.json()));
            if (connection)
              challengeIdentifiers.add(
                `_krakstack-sso-${connection.providerId}`,
              );
            return connection;
          });
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
            const ownerCookie = yield* loginCookie(owner);
            const outsiderCookie = yield* loginCookie(outsider);
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
            const updated = yield* service.save({
              userId: owner,
              settings: yield* Schema.decodeEffect(SsoSettingsBody)({
                ...payload,
                clientId: "updated-client",
                clientSecret: null,
              }),
            });
            expect(updated?.clientId).toBe("updated-client");
            expect(updated?.providerId).toBe(saved?.providerId);
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
            const [firstChallenge, concurrentChallenge] = yield* Effect.all(
              [readSettings(ownerCookie, id), readSettings(ownerCookie, id)],
              { concurrency: "unbounded" },
            );
            let challenge = firstChallenge;
            expect(challenge?.verificationToken).toBeTruthy();
            expect(concurrentChallenge?.verificationToken).toBe(
              challenge?.verificationToken,
            );
            expect(
              yield* sql`SELECT id FROM verification
                WHERE identifier = ${`_krakstack-sso-${saved?.providerId}`}`,
            ).toHaveLength(1);
            expect(
              (yield* readSettings(ownerCookie, id))?.verificationToken,
            ).toBe(challenge?.verificationToken);
            // Expired challenges cannot verify, and reopening settings renews
            // them through the plugin rather than reusing our old SQL column.
            yield* sql`UPDATE verification SET expires_at = now() - interval '1 second'
              WHERE identifier = ${`_krakstack-sso-${saved?.providerId}`}`;
            expect(
              (yield* Effect.promise(() =>
                settingsRequest(ownerCookie, id, true),
              )).status,
            ).toBe(404);
            const expiredToken = challenge?.verificationToken;
            challenge = yield* readSettings(ownerCookie, id);
            expect(challenge?.verificationToken).not.toBe(expiredToken);
            expect(
              (yield* Effect.promise(() =>
                settingsRequest(ownerCookie, id, true),
              )).status,
            ).toBe(400);
            dnsLookup.mockResolvedValue([[challenge?.verificationToken ?? ""]]);
            expect(
              (yield* Effect.promise(() =>
                settingsRequest(ownerCookie, id, true),
              )).status,
            ).toBe(200);
            const verified = yield* readSettings(ownerCookie, id);
            expect(verified?.domainVerified).toBe(true);
            expect(verified?.verificationToken).toBeUndefined();
            expect(dnsLookup).toHaveBeenCalledWith(challenge?.verificationName);
            expect(
              (yield* service.setEnabled({
                userId: owner,
                organizationId: id,
                enabled: true,
              }))?.enabled,
            ).toBe(true);
            const discoveryCalls = fetchCalls;
            for (const clientSecret of [undefined, payload.clientSecret]) {
              const unchanged = yield* service.save({
                userId: owner,
                settings: {
                  ...payload,
                  clientId: " updated-client ",
                  clientSecret,
                },
              });
              expect(unchanged?.enabled).toBe(true);
              expect(unchanged?.domainVerified).toBe(true);
              expect(unchanged?.clientId).toBe("updated-client");
            }
            expect(fetchCalls).toBe(discoveryCalls);
            const otherSaved = yield* service.save({
              userId: outsider,
              settings: { ...payload, organizationId: other },
            });
            const otherChallenge = yield* readSettings(outsiderCookie, other);
            expect(otherChallenge?.providerId).toBe(otherSaved?.providerId);
            dnsLookup.mockResolvedValue([
              [otherChallenge?.verificationToken ?? ""],
            ]);
            expect(
              (yield* Effect.promise(() =>
                settingsRequest(outsiderCookie, other, true),
              )).status,
            ).toBe(200);
            expect(
              yield* service
                .setEnabled({
                  userId: outsider,
                  organizationId: other,
                  enabled: true,
                })
                .pipe(Effect.flip),
            ).toMatchObject({ status: "CONFLICT" });
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

            const memberCookie = yield* loginCookie(member);
            expect(
              (yield* Effect.promise(() =>
                settingsRequest(memberCookie, id, true),
              )).status,
            ).toBe(403);
            expect(
              (yield* Effect.promise(() =>
                settingsRequest(outsiderCookie, id, true),
              )).status,
            ).toBe(403);
            const forbidden = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `https://localhost:3001/api/auth/organization/sso?organizationId=${id}`,
                  { headers: { cookie: memberCookie } },
                ),
              ),
            );
            expect(forbidden.status).toBe(403);
            yield* service.setEnabled({
              userId: owner,
              organizationId: id,
              enabled: true,
            });
            const unchangedResponse = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  "https://localhost:3001/api/auth/organization/sso",
                  {
                    method: "POST",
                    headers: {
                      origin: "https://localhost:3001",
                      cookie: ownerCookie,
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({
                      ...withoutSecret,
                      clientId: ` ${withoutSecret.clientId} `,
                      clientSecret: null,
                    }),
                  },
                ),
              ),
            );
            expect(unchangedResponse.status).toBe(200);
            expect(
              (yield* service.get({ userId: owner, organizationId: id }))
                ?.enabled,
            ).toBe(true);
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
                dnsLookup.mockReset();
                yield* sql`DELETE FROM verification WHERE identifier IN ${sql.in([...challengeIdentifiers])}`;
                yield* sql`DELETE FROM "user" WHERE id IN ${sql.in([owner, member, outsider])}`;
                yield* sql`DELETE FROM organization WHERE id IN ${sql.in([id, other])}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(
            OrganizationSso.layer.pipe(Layer.provideMerge(sqlTestLayer)),
          ),
        ),
      { timeout: 30_000 },
    );
  },
);
