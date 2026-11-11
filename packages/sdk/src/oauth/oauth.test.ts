import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { HttpClient, HttpClientResponse, HttpRouter } from "effect/http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { AuthClientConfig } from "../config.js";
import { AuthService } from "../service.js";
import { McpAuth } from "../server/mcp.js";
import { getOAuthAuthorizationQuery } from "./authorization.js";
import { verifyOAuthAccessToken } from "./verify.js";

const options = {
  issuer: "https://learning.example.com/api/auth",
  resource: "https://learning.example.com/api/mcp",
  jwksUrl: "https://learning.example.com/api/auth/jwks",
  requiredScopes: ["mcp:read"],
  scopesSupported: ["mcp:read", "mcp:write", "offline_access"],
  challengeScopes: ["mcp:read", "mcp:write", "offline_access"],
};

const fixture = Effect.gen(function* () {
  const keys = yield* Effect.promise(() => generateKeyPair("ES256"));
  const jwk = yield* Effect.promise(() => exportJWK(keys.publicKey));
  const kid = crypto.randomUUID();
  // A unique configured URL isolates the production JWKS cache per test.
  const config = { ...options, jwksUrl: `${options.jwksUrl}?test=${kid}` };
  const sign = (
    claims: Partial<{
      sub: string;
      azp: string;
      organization_id: string;
      scope: string;
      cnf: { jkt: string };
    }> = {},
    typ = "at+jwt",
    expiration = "5m",
  ) =>
    Effect.promise(() =>
      new SignJWT({
        sub: "user-1",
        azp: "agent-client",
        organization_id: "org-granted",
        scope: "openid mcp:read",
        ...claims,
      })
        .setProtectedHeader({ alg: "ES256", kid, typ })
        .setIssuer(config.issuer)
        .setAudience(config.resource)
        .setIssuedAt()
        .setExpirationTime(expiration)
        .sign(keys.privateKey),
    );
  const http = HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify({ keys: [{ ...jwk, kid }] })),
      ),
    ),
  );
  return { sign, config, http };
});

describe("OAuth resource authentication", () => {
  it.effect(
    "reports an unavailable JWKS as an outage, not invalid credentials",
    () =>
      Effect.gen(function* () {
        const { sign, config } = yield* fixture;
        const error = yield* verifyOAuthAccessToken(yield* sign(), config).pipe(
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make((request) =>
              Effect.succeed(
                HttpClientResponse.fromWeb(
                  request,
                  new Response(null, { status: 503 }),
                ),
              ),
            ),
          ),
          Effect.flip,
        );
        expect(error._tag).toBe("ServiceUnavailable");
      }),
  );
  it.effect("verifies an audience-bound access token", () =>
    Effect.gen(function* () {
      const { sign, config, http } = yield* fixture;
      const claims = yield* verifyOAuthAccessToken(yield* sign(), config).pipe(
        Effect.provideService(HttpClient.HttpClient, http),
      );
      expect(claims.sub).toBe("user-1");
      expect(claims.organization_id).toBe("org-granted");
    }),
  );

  for (const [name, overrides, typ] of [
    ["wrong issuer", { issuer: "https://other.example.com" }, "at+jwt"],
    [
      "wrong resource",
      { resource: "https://other.example.com/api/mcp" },
      "at+jwt",
    ],
    ["session JWT", {}, "JWT"],
  ] as const) {
    it.effect(`rejects ${name}`, () =>
      Effect.gen(function* () {
        const { sign, config, http } = yield* fixture;
        const error = yield* verifyOAuthAccessToken(yield* sign({}, typ), {
          ...config,
          ...overrides,
        }).pipe(
          Effect.provideService(HttpClient.HttpClient, http),
          Effect.flip,
        );
        expect(error._tag).toBe("Unauthorized");
      }),
    );
  }

  for (const [name, claims] of [
    ["missing tenant", { organization_id: undefined }],
    ["missing authorized client", { azp: undefined }],
    ["sender-constrained token without proof", { cnf: { jkt: "bound-key" } }],
  ] as const) {
    it.effect(`rejects ${name}`, () =>
      Effect.gen(function* () {
        const { sign, config, http } = yield* fixture;
        const error = yield* verifyOAuthAccessToken(
          yield* sign(claims),
          config,
        ).pipe(Effect.provideService(HttpClient.HttpClient, http), Effect.flip);
        expect(error._tag).toBe("Unauthorized");
      }),
    );
  }

  it.effect("distinguishes insufficient scope from invalid credentials", () =>
    Effect.gen(function* () {
      const { sign, config, http } = yield* fixture;
      const error = yield* verifyOAuthAccessToken(
        yield* sign({ scope: "openid" }),
        config,
      ).pipe(Effect.provideService(HttpClient.HttpClient, http), Effect.flip);
      expect(error._tag).toBe("Forbidden");
    }),
  );

  it.effect("rejects expired and tampered access tokens", () =>
    Effect.gen(function* () {
      const { sign, config, http } = yield* fixture;
      for (const token of [
        yield* sign({}, "at+jwt", "-1m"),
        `${yield* sign()}tampered`,
      ]) {
        const error = yield* verifyOAuthAccessToken(token, config).pipe(
          Effect.provideService(HttpClient.HttpClient, http),
          Effect.flip,
        );
        expect(error._tag).toBe("Unauthorized");
      }
    }),
  );

  for (const memberStatus of [200, 404]) {
    it.effect(
      `binds the actor to the consented tenant and rechecks membership (${memberStatus})`,
      () =>
        Effect.gen(function* () {
          const { sign, config, http } = yield* fixture;
          const token = yield* sign();
          const now = new Date().toISOString();
          const user = {
            id: "user-1",
            name: "User",
            email: "user@example.com",
            emailVerified: true,
            image: null,
            role: null,
            banned: false,
            createdAt: now,
            updatedAt: now,
          };
          const paths: string[] = [];
          const client = HttpClient.make((request) => {
            paths.push(request.url);
            if (request.url.startsWith(config.jwksUrl))
              return http.execute(request);
            const membership = request.url.includes("/members/");
            return Effect.succeed(
              HttpClientResponse.fromWeb(
                request,
                new Response(
                  JSON.stringify(
                    membership
                      ? {
                          id: "member-1",
                          organizationId: "org-granted",
                          userId: user.id,
                          role: "member",
                          createdAt: now,
                          user,
                        }
                      : user,
                  ),
                  { status: membership ? memberStatus : 200 },
                ),
              ),
            );
          });
          const auth = yield* AuthService.make({
            oauth: config,
            headers: {
              authorization: `Bearer ${token}`,
              "x-organization-id": "org-attacker",
            },
          }).pipe(
            Effect.provideService(
              AuthClientConfig,
              AuthClientConfig.of({
                baseUrl: "https://auth.example.com",
                apiKey: Redacted.make("service-key"),
              }),
            ),
            Effect.provideService(HttpClient.HttpClient, client),
          );
          if (memberStatus === 200) {
            const session = yield* auth.requireUserOrganization();
            expect(session.session.activeOrganizationId).toBe("org-granted");
            expect(session.authMethod.type).toBe("oauth");
            expect(session.session.token).toBe("");
          } else {
            const error = yield* auth.requireSession().pipe(Effect.flip);
            expect(error._tag).toBe("Forbidden");
          }
          expect(
            paths.some((path) =>
              path.includes("/organizations/org-granted/members/user-1"),
            ),
          ).toBe(true);
          expect(paths.some((path) => path.includes("org-attacker"))).toBe(
            false,
          );
        }),
    );
  }

  it.effect(
    "never falls back to cookies or an API key for an invalid bearer",
    () =>
      Effect.gen(function* () {
        const { config } = yield* fixture;
        let requests = 0;
        const auth = yield* AuthService.make({
          oauth: config,
          headers: {
            authorization: "Bearer not-a-jwt",
            cookie: "session=valid",
            "x-api-key": "valid-key",
          },
        }).pipe(
          Effect.provideService(
            AuthClientConfig,
            AuthClientConfig.of({
              baseUrl: "https://auth.example.com",
              apiKey: Redacted.make("service-key"),
            }),
          ),
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make(() => {
              requests++;
              return Effect.die(
                "Invalid token must not trigger a session lookup",
              );
            }),
          ),
        );
        const error = yield* auth.requireSession().pipe(Effect.flip);
        expect(error._tag).toBe("Unauthorized");
        expect(requests).toBe(0);
      }),
  );

  it.effect(
    "publishes resource metadata and challenges anonymous MCP initialization",
    () =>
      Effect.gen(function* () {
        const web = yield* Effect.acquireRelease(
          Effect.sync(() =>
            HttpRouter.toWebHandler(
              Layer.mergeAll(
                McpAuth.metadataLayer(options),
                HttpRouter.add(
                  "POST",
                  "/api/mcp",
                  Effect.die("Anonymous request reached MCP"),
                ).pipe(Layer.provide(McpAuth.middleware(options).layer)),
              ),
              { disableLogger: true },
            ),
          ),
          (web) => Effect.promise(web.dispose),
        );
        const metadata = yield* Effect.promise(() =>
          web.handler(
            new Request(
              "https://learning.example.com/.well-known/oauth-protected-resource/api/mcp",
            ),
          ),
        );
        expect(yield* Effect.promise(() => metadata.json())).toEqual({
          resource: options.resource,
          authorization_servers: [options.issuer],
          scopes_supported: ["mcp:read", "mcp:write", "offline_access"],
          bearer_methods_supported: ["header"],
        });
        const response = yield* Effect.promise(() =>
          web.handler(new Request(options.resource, { method: "POST" })),
        );
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toContain(
          'resource_metadata="https://learning.example.com/.well-known/oauth-protected-resource/api/mcp"',
        );
        expect(response.headers.get("www-authenticate")).toContain(
          'scope="mcp:read mcp:write offline_access"',
        );
      }),
  );
});

describe("OAuth continuation", () => {
  it("restores JSON-encoded repeated fields and selects signed fields regardless of ordering", () => {
    const names = ["client_id", "resource", "state", "ba_param"];
    const search = new URLSearchParams({
      method: "password",
      sig: "signature",
      client_id: "agent",
      resource: JSON.stringify([
        "https://example.com/mcp",
        "https://example.com/other",
      ]),
      state: "opaque-state",
      ba_param: JSON.stringify(names),
      email: "user@example.com",
    });
    const restored = new URLSearchParams(
      getOAuthAuthorizationQuery(search.toString())!,
    );
    expect(restored.getAll("ba_param")).toEqual(names);
    expect(restored.getAll("resource")).toEqual([
      "https://example.com/mcp",
      "https://example.com/other",
    ]);
    expect(restored.get("state")).toBe("opaque-state");
    expect(restored.get("sig")).toBe("signature");
    expect(restored.has("method")).toBe(false);
    expect(restored.has("email")).toBe(false);
  });

  it("leaves opaque strings and malformed array values unchanged for provider verification", () => {
    for (const resource of ["https://example.com/mcp", "[invalid", "[1,2]"]) {
      const search = new URLSearchParams({
        client_id: "agent",
        resource,
        sig: "signature",
      });
      expect(getOAuthAuthorizationQuery(search.toString())).toBe(
        search.toString(),
      );
    }
  });

  it("routes only known discovery documents through the existing proxy", () => {
    const request = new Request(
      "https://learning.example.com/.well-known/oauth-authorization-server/api/auth",
    );
    expect(McpAuth.discoveryRequest(request, options)?.url).toBe(
      "https://learning.example.com/api/auth/.well-known/oauth-authorization-server",
    );
    expect(
      McpAuth.discoveryRequest(
        new Request("https://learning.example.com/.well-known/unknown"),
        options,
      ),
    ).toBeUndefined();
  });
  it("preserves resource, PKCE and state while dropping UI additions after the signature", () => {
    const signed =
      "client_id=agent&resource=https%3A%2F%2Flearning.example.com%2Fapi%2Fmcp&state=state&code_challenge=challenge&sig=signature";
    expect(
      getOAuthAuthorizationQuery(
        `?${signed}&method=password&email=user%40example.com&client_id=other&scope=admin`,
      ),
    ).toBe(signed);
    expect(getOAuthAuthorizationQuery("?redirect=/admin")).toBeNull();
  });
});
