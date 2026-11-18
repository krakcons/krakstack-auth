import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createHash } from "node:crypto";
import { vi } from "vitest";
import { Events } from "@krak-stack/registry/events";
import type { TrackEvent } from "@krak-stack/registry/events/schema";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sqlTestLayer } from "@/services/database";
import { createAuth } from "../config";
import { handleProjectOAuth } from "../project-oauth";
import { SsoOidcJson } from "./schema";
import { encryptSsoConfig } from "./settings";

const origin = "https://localhost:3001";
const cookieFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "organization OIDC sign-in",
  () => {
    it.effect(
      "links verified members, selects their organization and fails closed for other identities and unsafe flows",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const events = yield* Events;
          const tracked: Array<Parameters<Events["Service"]["track"]>[0]> = [];
          const runAudit = Effect.runPromiseWith(
            yield* Effect.context<never>(),
          );
          const id = `sso-${crypto.randomUUID()}`;
           const domain = `${id}.example.com`;
           const projectOrigin = `https://${domain}`;
           const sharedCallback = `${origin}/api/auth/sso/callback`;
           let expectedCallback = `${origin}/api/auth/sso/callback/${id}`;
          const memberEmail = `member@${domain}`;
          const outsiderEmail = `outsider@${domain}`;
          const unverifiedEmail = `unverified@${domain}`;
          const userIds = [
            `${id}-member`,
            `${id}-outsider`,
            `${id}-unverified`,
          ];
          const config = {
            providerId: id,
            issuer: `https://login.microsoftonline.com/${crypto.randomUUID()}/v2.0`,
            clientId: `${id}-client`,
            clientSecret: `${id}-secret`,
            organizationId: id,
            domain,
            trustedOrigins: [],
          };
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            auditRun: (effect) =>
              runAudit(
                effect.pipe(
                  Effect.provideService(Events, {
                    ...events,
                    track: (event: TrackEvent) => {
                      if (event.category === "audit") tracked.push(event);
                      return events.track(event);
                    },
                  }),
                ),
              ),
          });
          const keys = yield* Effect.promise(() => generateKeyPair("RS256"));
          const jwk = yield* Effect.promise(() => exportJWK(keys.publicKey));
          let subject = "member-subject";
          let email = memberEmail;
          let tokenIssuer = config.issuer;
          let tokenAudience = config.clientId;
          let lastVerifier: string | null = null;
          let tokenCalls = 0;
          const discovery = {
            issuer: config.issuer,
            authorization_endpoint: `${config.issuer}/authorize`,
            token_endpoint: `${config.issuer}/token`,
            jwks_uri: `${config.issuer}/keys`,
            token_endpoint_auth_methods_supported: ["client_secret_post"],
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
          };
          vi.stubGlobal(
            "fetch",
            async (input: RequestInfo | URL, init?: RequestInit) => {
              const request = new Request(input, init);
              if (
                request.url ===
                `${config.issuer}/.well-known/openid-configuration`
              )
                return Response.json(discovery);
              if (request.url === discovery.jwks_uri)
                return Response.json({
                  keys: [{ ...jwk, kid: id, alg: "RS256", use: "sig" }],
                });
              if (request.url === discovery.token_endpoint) {
                tokenCalls++;
                const form = new URLSearchParams(await request.text());
                lastVerifier = form.get("code_verifier");
                expect(form.get("client_secret")).toBe(config.clientSecret);
                expect(form.get("redirect_uri")).toBe(
                   expectedCallback,
                );
                const token = await new SignJWT({
                  email,
                  name: "IdP name must not replace local name",
                })
                  .setProtectedHeader({ alg: "RS256", kid: id })
                  .setSubject(subject)
                  .setIssuer(tokenIssuer)
                  .setAudience(tokenAudience)
                  .setIssuedAt()
                  .setExpirationTime("5m")
                  .sign(keys.privateKey);
                return Response.json({
                  access_token: "test-access-token",
                  token_type: "Bearer",
                  expires_in: 300,
                  id_token: token,
                });
              }
              throw new Error("Unexpected OIDC network request");
            },
          );
          const post = (path: string, body: Schema.Json) =>
            Effect.promise(() =>
              auth.handler(
                new Request(`${origin}/api/auth${path}`, {
                  method: "POST",
                  headers: { origin, "content-type": "application/json" },
                  body: JSON.stringify(body),
                }),
              ),
            );
          const begin = Effect.fnUntraced(function* () {
            const response = yield* post("/sign-in/sso", {
              providerId: id,
              callbackURL: `${origin}/admin`,
              errorCallbackURL: `${origin}/sign-in`,
            });
            expect(response.status).toBe(200);
            const body = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ url: Schema.String }),
            )(yield* Effect.promise(() => response.json()));
            const url = new URL(body.url);
            expect(url.origin).toBe("https://login.microsoftonline.com");
            expect(url.searchParams.get("code_challenge_method")).toBe("S256");
            expect(url.searchParams.get("code_challenge")).toBeTruthy();
            const callback = new URL(`${origin}/api/auth/sso/callback/${id}`);
            callback.searchParams.set(
              "state",
              url.searchParams.get("state") ?? "",
            );
            callback.searchParams.set("code", "test-code");
            return {
              callback,
              cookie: cookieFrom(response),
              challenge: url.searchParams.get("code_challenge"),
            };
          });
          const finish = (flow: { callback: URL; cookie: string }) =>
            Effect.promise(() =>
              auth.handler(
                new Request(flow.callback, {
                  headers: { cookie: flow.cookie },
                }),
              ),
            );

          yield* Effect.gen(function* () {
            yield* sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${id}, 'SSO organization', ${id}, now()), (${`${id}-other`}, 'Other organization', ${`${id}-other`}, now())`;
            yield* sql`INSERT INTO "user" (id, name, email, email_verified) VALUES (${userIds[0]}, 'Local member', ${memberEmail}, true), (${userIds[1]}, 'Outsider', ${outsiderEmail}, true), (${userIds[2]}, 'Unverified', ${unverifiedEmail}, false)`;
            yield* sql`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (${`${id}-m1`}, ${id}, ${userIds[0]}, 'member', now()), (${`${id}-m2`}, ${`${id}-other`}, ${userIds[1]}, 'owner', now()), (${`${id}-m3`}, ${id}, ${userIds[2]}, 'member', now())`;
            const oidc = yield* Schema.encodeEffect(SsoOidcJson)({
              issuer: config.issuer,
              clientId: config.clientId,
              clientSecret: config.clientSecret,
              discoveryEndpoint: `${config.issuer}/.well-known/openid-configuration`,
              authorizationEndpoint: discovery.authorization_endpoint,
              tokenEndpoint: discovery.token_endpoint,
              jwksEndpoint: discovery.jwks_uri,
              pkce: true,
              scopes: ["openid", "profile", "email"],
              tokenEndpointAuthentication: "client_secret_post",
            });
            const encrypted = yield* encryptSsoConfig(oidc);
            yield* sql`INSERT INTO sso_provider (id, provider_id, issuer, oidc_config, user_id, organization_id, domain, domain_verified, enabled)
              VALUES (${id}, ${id}, ${config.issuer}, ${encrypted}, ${userIds[0]}, ${id}, ${domain}, true, true)`;

            const publicConfig = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `${origin}/api/auth/sso/config?email=${encodeURIComponent(memberEmail)}`,
                ),
              ),
            );
            expect(yield* Effect.promise(() => publicConfig.json())).toEqual({
              providerId: id,
            });
            for (const path of [
              "/sso/register",
              "/sso/update-provider",
              "/sso/delete-provider",
            ]) {
              expect((yield* post(path, {})).status).toBe(404);
            }
            const unsafe = yield* post("/sign-in/sso", {
              providerId: id,
              callbackURL: "https://evil.example/",
              errorCallbackURL: `${origin}/sign-in`,
            });
            expect(unsafe.status).toBe(403);
            expect(
              (yield* post("/sign-in/sso", {
                providerId: id,
                callbackURL: `${config.issuer}/redirect`,
              })).status,
            ).toBe(403);
            yield* Effect.promise(async () => {
              await expect(
                auth.api.signInSSO({
                  body: {
                    providerId: id,
                    callbackURL: "https://evil.example/",
                  },
                }),
              ).rejects.toMatchObject({ statusCode: 403 });
            });
            const disallowedOptions: Array<Record<string, Schema.Json>> = [
              { requestSignUp: true },
              { additionalParams: { prompt: "none" } },
              { providerType: "saml" },
            ];
            for (const extra of disallowedOptions) {
              expect(
                (yield* post("/sign-in/sso", {
                  providerId: id,
                  callbackURL: `${origin}/admin`,
                  ...extra,
                })).status,
              ).toBe(400);
            }

            const flow = yield* begin();
            expect(tracked).toEqual([]);
            const response = yield* finish(flow);
            expect(response.headers.get("location")).toBe(`${origin}/admin`);
            expect(cookieFrom(response)).toContain("krakstack-auth.last_used_login_method=sso");
            expect(lastVerifier).toBeTruthy();
            expect(
              createHash("sha256")
                .update(lastVerifier ?? "")
                .digest("base64url"),
            ).toBe(flow.challenge);
            const session = yield* Effect.promise(() =>
              auth.api.getSession({
                headers: new Headers({
                  cookie: cookieFrom(response),
                  host: "localhost:3001",
                  "x-forwarded-proto": "https",
                }),
              }),
            );
            expect(session?.user.id).toBe(userIds[0]);
            expect(session?.user.name).toBe("Local member");
            expect(session?.session.activeOrganizationId).toBe(id);
            expect(tracked).toHaveLength(1);
            expect(tracked[0]?.name).toBe("auth.session.signed_in");
            expect(tracked[0]?.properties).toMatchObject({
              sessionIssued: true,
              subjectUserId: userIds[0],
            });
            expect(JSON.stringify(tracked)).not.toContain(config.clientSecret);
            expect(
              yield* sql`SELECT user_id FROM account WHERE provider_id = ${id}`,
            ).toEqual([{ userId: userIds[0] }]);

            yield* sql`INSERT INTO project (id, name) VALUES (${id}, 'Shared SSO project')`;
            yield* sql`INSERT INTO domains (id, hostname, root_hostname, project_id, hostname_id, managed, active)
              VALUES (${id}, ${domain}, ${domain}, ${id}, ${id}, false, true)`;
            vi.stubEnv("BETTER_AUTH_URL", origin);
            expectedCallback = sharedCallback;
            yield* Effect.promise(async () => {
              const handle = (request: Request) =>
                handleProjectOAuth(request, auth, (fixedBaseURL, projectId, sharedSsoRedirectURI) =>
                  createAuth({
                    allowedHosts: ["localhost:3001"],
                    fixedBaseURL,
                    projectId,
                    sharedSsoRedirectURI,
                    auditRun: (effect) => runAudit(effect.pipe(Effect.provideService(Events, events))),
                  }),
                );
              const proxyHeaders = { "x-forwarded-host": domain, "x-forwarded-proto": "https" };
              const start = await handle(new Request(`${origin}/api/auth/sign-in/sso`, {
                method: "POST",
                headers: { ...proxyHeaders, origin: projectOrigin, "content-type": "application/json" },
                body: JSON.stringify({ providerId: id, callbackURL: `${projectOrigin}/admin` }),
              }));
              expect(start?.status).toBe(200);
              const projectCookie = cookieFrom(start!);
              const { url } = Schema.decodeUnknownSync(Schema.Struct({ url: Schema.String }))(await start?.json());
              const redirect = await handle(new Request(url));
              expect(redirect?.status).toBe(303);
              const authorize = new URL(redirect?.headers.get("location") ?? "");
              expect(authorize.searchParams.get("redirect_uri")).toBe(sharedCallback);
              const callback = new URL(sharedCallback);
              callback.searchParams.set("state", authorize.searchParams.get("state") ?? "");
              callback.searchParams.set("code", "test-shared-code");
              const done = await handle(new Request(callback, { headers: { cookie: cookieFrom(redirect!) } }));
              expect(done?.status).toBe(303);
              expect(cookieFrom(done!)).not.toContain("session_token");
              const redeem = new URL(done?.headers.get("location") ?? "");
              expect(redeem.origin).toBe(projectOrigin);
              const local = await handle(new Request(new URL(redeem.pathname + redeem.search, origin), {
                headers: { ...proxyHeaders, cookie: projectCookie },
              }));
              expect(local?.headers.get("location")).toBe(`${projectOrigin}/admin`);
              expect(local?.headers.getSetCookie()).toContainEqual(
                expect.stringContaining("krakstack-auth.last_used_login_method=sso;"),
              );
              const session = await auth.api.getSession({ headers: new Headers({
                cookie: cookieFrom(local!), host: "localhost:3001", "x-forwarded-proto": "https",
              }) });
              expect(session?.user.id).toBe(userIds[0]);
              expect(session?.session.activeOrganizationId).toBe(id);
            });
            expectedCallback = `${origin}/api/auth/sso/callback/${id}`;

            const callsBeforeReplay = tokenCalls;
            const replay = yield* finish(flow);
            expect(replay.headers.get("location")).not.toBe(`${origin}/admin`);
            expect(tokenCalls).toBe(callsBeforeReplay);

            // Stable provider subject, not a mutable email, owns an existing account.
            email = `renamed@${domain}`;
            expect(
              (yield* finish(yield* begin())).headers.get("location"),
            ).toBe(`${origin}/admin`);
            expect(tracked).toHaveLength(2);
            yield* sql`UPDATE "user" SET banned = true WHERE id = ${userIds[0]}`;
            expect(
              (yield* finish(yield* begin())).headers.get("location"),
            ).not.toBe(`${origin}/admin`);
            yield* sql`UPDATE "user" SET banned = false WHERE id = ${userIds[0]}`;
            yield* sql`DELETE FROM member WHERE id = ${`${id}-m1`}`;
            expect(
              (yield* finish(yield* begin())).headers.get("location"),
            ).toContain("SSO_MEMBERSHIP_REQUIRED");

            for (const identity of [
              { email: outsiderEmail, subject: "outsider-subject" },
              { email: unverifiedEmail, subject: "unverified-subject" },
              { email: `unknown@${domain}`, subject: "unknown-subject" },
              {
                email: "member@unrelated.example",
                subject: "foreign-domain-subject",
              },
            ]) {
              email = identity.email;
              subject = identity.subject;
              expect(
                (yield* finish(yield* begin())).headers.get("location"),
              ).toContain("SSO_MEMBERSHIP_REQUIRED");
            }
            email = memberEmail;
            subject = "member-subject";
            tokenIssuer = "https://another-tenant.example";
            expect(
              (yield* finish(yield* begin())).headers.get("location"),
            ).not.toBe(`${origin}/admin`);
            tokenIssuer = config.issuer;
            tokenAudience = "wrong-client";
            expect(
              (yield* finish(yield* begin())).headers.get("location"),
            ).not.toBe(`${origin}/admin`);
            expect(tracked).toHaveLength(2);
            expect(
              yield* sql`SELECT id FROM "user" WHERE email = ${`unknown@${domain}`}`,
            ).toEqual([]);
            expect(
              yield* sql`SELECT user_id FROM account WHERE provider_id = ${id}`,
            ).toEqual([{ userId: userIds[0] }]);
            expect(
              yield* sql`SELECT user_id FROM member WHERE organization_id = ${id}`,
            ).toEqual([{ userId: userIds[2] }]);

            yield* sql`UPDATE sso_provider SET enabled = false WHERE id = ${id}`;
            const disabled = auth;
            expect(
              yield* Effect.promise(() =>
                disabled.api.getSsoConfig({ query: { email: memberEmail } }),
              ),
            ).toBeNull();
            const disabledResponse = yield* Effect.promise(() =>
              disabled.handler(
                new Request(`${origin}/api/auth/sign-in/sso`, {
                  method: "POST",
                  headers: { origin, "content-type": "application/json" },
                  body: JSON.stringify({
                    providerId: id,
                    callbackURL: `${origin}/admin`,
                  }),
                }),
              ),
            );
            expect(disabledResponse.status).toBe(404);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                vi.unstubAllGlobals();
                vi.unstubAllEnvs();
                yield* sql`DELETE FROM project_oauth_flow WHERE project_id = ${id}`;
                yield* sql`DELETE FROM domains WHERE id = ${id}`;
                yield* sql`DELETE FROM project WHERE id = ${id}`;
                yield* sql`DELETE FROM events WHERE user_id IN ${sql.in(userIds)}`;
                yield* sql`DELETE FROM "user" WHERE id IN ${sql.in(userIds)}`;
                yield* sql`DELETE FROM organization WHERE id IN ${sql.in([id, `${id}-other`])}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(Layer.mergeAll(testEventsLayer, sqlTestLayer))),
      { timeout: 30_000 },
    );
  },
);
