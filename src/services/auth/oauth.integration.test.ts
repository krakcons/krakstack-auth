import { describe, expect, it } from "@effect/vitest";
import { Effect, ManagedRuntime, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { createHash } from "node:crypto";
import {
  defaultParseSearch,
  defaultStringifySearch,
} from "@tanstack/react-router";
import { getOAuthAuthorizationQuery } from "../../../packages/sdk/src/oauth/authorization";
import {
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
  createLocalJWKSet,
} from "jose";

import { sqlTestLayer } from "@/services/database";
import { testEventsLayer } from "@/services/audit/test-layer";
import { createAuth } from "./config";

const TokenResponse = Schema.Struct({
  access_token: Schema.NonEmptyString,
  refresh_token: Schema.NonEmptyString,
}).annotate({ identifier: "TestOAuthTokenResponse" });
const RedirectResponse = Schema.Struct({ url: Schema.String }).annotate({
  identifier: "TestOAuthRedirect",
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "MCP OAuth authorization",
  () => {
    it.effect(
      "advertises anonymous DCR only when enabled and limits registrations to the MCP resource",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const runtime = ManagedRuntime.make(testEventsLayer);
          const origin = "https://localhost:3001";
          const resource = `${origin}/api/mcp/dcr-${crypto.randomUUID()}`;
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            mcpResource: resource,
            auditRun: (effect) => runtime.runPromise(effect),
          });
          let clientId = "";
          yield* Effect.gen(function* () {
            const metadata = yield* Effect.promise(() =>
              auth.handler(
                new Request(
                  `${origin}/api/auth/.well-known/oauth-authorization-server`,
                ),
              ),
            );
            const discovery = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ registration_endpoint: Schema.String }),
            )(yield* Effect.promise(() => metadata.json()));
            expect(discovery.registration_endpoint).toBe(
              `${origin}/api/auth/oauth2/register`,
            );
            const register = (
              extra: {
                resources?: string[];
                scope?: string;
                grant_types?: string[];
                redirect_uris?: string[];
                application_type?: string;
              } = {},
            ) =>
              Effect.promise(() =>
                auth.handler(
                  new Request(discovery.registration_endpoint, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      client_name: "MCP agent",
                      redirect_uris: [
                        "http://127.0.0.1:19876/mcp/oauth/callback",
                      ],
                      token_endpoint_auth_method: "none",
                      grant_types: ["authorization_code", "refresh_token"],
                      ...extra,
                    }),
                  }),
                ),
              );
            const registered = yield* register();
            expect(registered.status).toBe(201);
            const client = yield* Schema.decodeUnknownEffect(
              Schema.Struct({
                client_id: Schema.String,
                token_endpoint_auth_method: Schema.String,
                application_type: Schema.String,
              }),
            )(yield* Effect.promise(() => registered.json()));
            clientId = client.client_id;
            expect(client.token_endpoint_auth_method).toBe("none");
            expect(client.application_type).toBe("native");
            const links =
              yield* sql`SELECT resource_id FROM oauth_client_resource WHERE client_id = ${clientId}`;
            expect(links).toEqual([{ resourceId: resource }]);
            const otherProject = yield* register({
              resources: ["https://other-project.example.com/api/mcp"],
            });
            expect(otherProject.status).toBe(400);
            const excessiveScope = yield* register({ scope: "mcp:write" });
            expect(excessiveScope.status).toBe(400);
            const machineAccess = yield* register({
              grant_types: ["client_credentials"],
            });
            expect(machineAccess.status).toBe(400);
            expect(
              (yield* register({
                redirect_uris: ["http://remote.example.com/callback"],
              })).status,
            ).toBe(400);
            expect((yield* register({ application_type: "web" })).status).toBe(
              400,
            );
            const disabled = createAuth({ allowedHosts: ["localhost:3001"] });
            const rejected = yield* Effect.promise(() =>
              disabled.handler(
                new Request(discovery.registration_endpoint, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    redirect_uris: ["https://agent.example.com/callback"],
                  }),
                }),
              ),
            );
            expect(rejected.status).toBe(403);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM oauth_client WHERE client_id = ${clientId}`;
                yield* sql`DELETE FROM oauth_resource WHERE identifier = ${resource}`;
                yield* Effect.promise(() => runtime.dispose());
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(sqlTestLayer)),
      { timeout: 30_000 },
    );

    it.effect(
      "returns a PKCE code to the agent and issues tenant-bound access/refresh tokens",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const runtime = ManagedRuntime.make(testEventsLayer);
          const id = `mcp-${crypto.randomUUID()}`;
          const origin = "https://localhost:3001";
          const resource = `https://localhost:3001/api/mcp/${id}`;
          const callback = "http://127.0.0.1:43210/callback";
          const auth = createAuth({
            allowedHosts: ["localhost:3001"],
            mcpResource: resource,
            mcpDynamicClientRegistration: false,
            mcpScopes: ["mcp:read", "mcp:write"],
            auditRun: (effect) => runtime.runPromise(effect),
          });
          const context = yield* Effect.promise(() => auth.$context);
          let clientId = "";
          let organizationId = "";
          yield* Effect.gen(function* () {
            const now = new Date();
            yield* Effect.promise(() =>
              context.adapter.create({
                model: "user",
                forceAllowId: true,
                data: {
                  id,
                  email: `${id}@example.com`,
                  name: "MCP test",
                  emailVerified: true,
                  role: "admin",
                  createdAt: now,
                  updatedAt: now,
                },
              }),
            );
            const password = "mcp-test-password-12345";
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
              auth.handler(
                new Request(`${origin}/api/auth/sign-in/email`, {
                  method: "POST",
                  headers: { "content-type": "application/json", origin },
                  body: JSON.stringify({
                    email: `${id}@example.com`,
                    password,
                  }),
                }),
              ),
            );
            expect(signIn.status).toBe(200);
            const cookie = signIn.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            const headers = new Headers({
              cookie,
              origin,
              host: "localhost:3001",
              "x-forwarded-host": "localhost:3001",
              "x-forwarded-proto": "https",
            });
            const sessionResponse = yield* Effect.promise(() =>
              auth.handler(
                new Request(`${origin}/api/auth/get-session`, { headers }),
              ),
            );
            const session = yield* Schema.decodeUnknownEffect(
              Schema.Struct({
                session: Schema.Struct({ activeOrganizationId: Schema.String }),
              }),
            )(yield* Effect.promise(() => sessionResponse.json()));
            organizationId = session.session.activeOrganizationId;
            expect(organizationId).not.toBe("");
            const client = yield* Effect.promise(() =>
              auth.api.adminCreateOAuthClient({
                headers,
                body: {
                  client_name: "Test agent",
                  redirect_uris: [callback],
                  scope: "mcp:read mcp:write offline_access",
                  token_endpoint_auth_method: "none",
                  application_type: "native",
                  grant_types: ["authorization_code", "refresh_token"],
                  require_pkce: true,
                },
              }),
            );
            clientId = client.client_id;
            yield* Effect.promise(() =>
              auth.api.adminLinkClientResource({
                headers,
                params: { identifier: resource, client_id: clientId },
              }),
            );
            const verifier = crypto.randomUUID() + crypto.randomUUID();
            const authorize = new URL(`${origin}/api/auth/oauth2/authorize`);
            authorize.search = new URLSearchParams({
              client_id: clientId,
              redirect_uri: callback,
              response_type: "code",
              scope: "mcp:read mcp:write offline_access",
              state: id,
              resource,
              code_challenge: createHash("sha256")
                .update(verifier)
                .digest("base64url"),
              code_challenge_method: "S256",
            }).toString();
            const anonymous = yield* Effect.promise(() =>
              auth.handler(new Request(authorize)),
            );
            const login = new URL(anonymous.headers.get("location")!, origin);
            expect(login.pathname).toBe("/sign-in");
            expect(login.searchParams.has("sig")).toBe(true);
            const authorized = yield* Effect.promise(() =>
              auth.handler(new Request(authorize, { headers })),
            );
            const consent = new URL(
              authorized.headers.get("location")!,
              origin,
            );
            expect(consent.pathname).toBe("/consent");
            // Reproduce the router collapsing repeated ba_param fields into a
            // JSON array before the consent form submits the signed request.
            const normalized = defaultStringifySearch(
              defaultParseSearch(consent.search),
            );
            expect(new URLSearchParams(normalized).get("ba_param")).toContain(
              "[",
            );
            const oauthQuery = getOAuthAuthorizationQuery(normalized);
            expect(new URLSearchParams(oauthQuery!).getAll("ba_param")).toEqual(
              consent.searchParams.getAll("ba_param"),
            );
            const decision = yield* Effect.promise(() =>
              auth.handler(
                new Request(`${origin}/api/auth/oauth2/consent`, {
                  method: "POST",
                  headers: {
                    ...Object.fromEntries(headers),
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({
                    accept: true,
                    scope: "mcp:read mcp:write offline_access",
                    oauth_query: oauthQuery,
                  }),
                }),
              ),
            );
            expect(decision.status).toBe(200);
            const redirect = yield* Schema.decodeUnknownEffect(
              RedirectResponse,
            )(yield* Effect.promise(() => decision.json()));
            const backToAgent = new URL(redirect.url);
            expect(backToAgent.origin + backToAgent.pathname).toBe(callback);
            expect(backToAgent.searchParams.get("state")).toBe(id);
            const code = backToAgent.searchParams.get("code")!;
            const exchange = (body: URLSearchParams) =>
              Effect.promise(() =>
                auth.handler(
                  new Request(`${origin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body,
                  }),
                ),
              );
            const response = yield* exchange(
              new URLSearchParams({
                grant_type: "authorization_code",
                client_id: clientId,
                redirect_uri: callback,
                code,
                code_verifier: verifier,
                resource,
              }),
            );
            expect(response.status).toBe(200);
            const tokens = yield* Schema.decodeUnknownEffect(TokenResponse)(
              yield* Effect.promise(() => response.json()),
            );
            expect(decodeProtectedHeader(tokens.access_token).typ).toBe(
              "at+jwt",
            );
            expect(decodeJwt(tokens.access_token).scope).toContain("mcp:write");
            expect(decodeJwt(tokens.access_token)).toMatchObject({
              sub: id,
              aud: resource,
              organization_id: organizationId,
              azp: clientId,
            });
            const jwks = yield* Effect.promise(() => auth.api.getJwks());
            yield* Effect.promise(() =>
              jwtVerify(tokens.access_token, createLocalJWKSet(jwks), {
                issuer: `${origin}/api/auth`,
                audience: resource,
                typ: "at+jwt",
              }),
            );
            const refreshed = yield* exchange(
              new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: tokens.refresh_token,
                client_id: clientId,
                resource,
              }),
            );
            expect(refreshed.status).toBe(200);
            const rotated = yield* Schema.decodeUnknownEffect(TokenResponse)(
              yield* Effect.promise(() => refreshed.json()),
            );
            expect(decodeJwt(rotated.access_token).organization_id).toBe(
              organizationId,
            );
            expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM oauth_client WHERE client_id = ${clientId}`;
                yield* sql`DELETE FROM oauth_resource WHERE identifier = ${resource}`;
                yield* sql`DELETE FROM "user" WHERE id = ${id}`;
                if (organizationId)
                  yield* sql`DELETE FROM organization WHERE id = ${organizationId}`;
                yield* Effect.promise(() => runtime.dispose());
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(Effect.provide(sqlTestLayer)),
      { timeout: 30_000 },
    );
  },
);
