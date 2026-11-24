import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpRouter,
} from "effect/http";
import { HttpApi, HttpApiBuilder, HttpApiError } from "effect/http-api";

import { defineProjectAccess } from "./access.js";
import { AuthClientConfig } from "./config.js";
import { AuthService } from "./service.js";
import { ActorRequired } from "./server/actor.js";
import { getCurrentIdentity, IdentityApiGroup } from "./server/identity.js";
import { makeAuthenticationLive } from "./server/middleware.js";

const IdentityApi = HttpApi.make("IdentityTest")
  .add(IdentityApiGroup)
  .prefix("/api");
const IdentityAccess = defineProjectAccess({
  project: "test",
  permissions: ["read"],
  roles: { member: ["read"] },
});
const requestIdentity = (auth: typeof AuthService.Service) =>
  Effect.gen(function* () {
    const web = yield* Effect.acquireRelease(
      Effect.sync(() =>
        HttpRouter.toWebHandler(
          HttpApiBuilder.layer(IdentityApi).pipe(
            Layer.provide(
              HttpApiBuilder.group(IdentityApi, "identity", (handlers) =>
                handlers.handle("getCurrentIdentity", getCurrentIdentity),
              ),
            ),
            Layer.provide(ActorRequired.layer(IdentityAccess)),
            Layer.provide(
              makeAuthenticationLive({
                authLayer: Layer.succeed(AuthService, auth),
              }),
            ),
          ),
          { disableLogger: true },
        ),
      ),
      (web) => Effect.promise(web.dispose),
    );
    return yield* Effect.promise(() =>
      web.handler(new Request("http://localhost/api/identity")),
    );
  });

const now = "2026-01-01T00:00:00.000Z";

const verifiedUserKey = {
  id: "user-key-1",
  configId: "user",
  name: "User key",
  start: "user_1234",
  prefix: "user_",
  referenceId: "user-1",
  enabled: true,
  expiresAt: null,
  createdAt: now,
  updatedAt: now,
  permissions: null,
  metadata: null,
};

const verifiedOrganizationKey = {
  ...verifiedUserKey,
  id: "organization-key-1",
  configId: "organization",
  name: "Organization key",
  start: "organization_1234",
  prefix: "organization_",
  referenceId: "org-owned",
};

const user = {
  id: "user-1",
  createdAt: now,
  updatedAt: now,
  email: "user@example.com",
  emailVerified: true,
  image: null,
  name: "Test User",
  role: null,
  banned: false,
};

const response = (
  request: HttpClientRequest.HttpClientRequest,
  status: number,
  body?: typeof Schema.Unknown.Type,
) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );

const makeAuth = (
  handler: Parameters<typeof HttpClient.make>[0],
  headers: Record<string, string> = { "x-api-key": "user_secret" },
  memoizeCookieSessionForRequest?: boolean,
) =>
  AuthService.make({
    headers,
    apiKeyConfigId: "user",
    memoizeCookieSessionForRequest,
  }).pipe(
    Effect.provideService(
      AuthClientConfig,
      AuthClientConfig.of({
        baseUrl: "http://auth.test",
        apiKey: Redacted.make("service-secret"),
      }),
    ),
    Effect.provideService(HttpClient.HttpClient, HttpClient.make(handler)),
  );

const expectSessionError = (
  handler: Parameters<typeof HttpClient.make>[0],
  ErrorClass:
    typeof HttpApiError.Unauthorized | typeof HttpApiError.ServiceUnavailable,
  headers?: Record<string, string>,
) =>
  Effect.gen(function* () {
    const auth = yield* makeAuth(handler, headers);
    const error = yield* auth.getSession().pipe(Effect.flip);

    expect(error).toBeInstanceOf(ErrorClass);
  });

describe("AuthService batch email lookup", () => {
  it.effect("uses service credentials and decodes the recipient locale", () =>
    Effect.gen(function* () {
      const email = "learner+french@example.com";
      const auth = yield* makeAuth((request, url) => {
        expect(url.pathname).toBe("/api/users/by-email");
        expect(url.searchParams.get("emails")).toBe(
          `${email},missing@example.com`,
        );
        expect(request.headers.authorization).toBe("Bearer service-secret");
        return Effect.succeed(
          response(request, 200, {
            data: [{ ...user, email, locale: "fr" }],
            missingEmails: ["missing@example.com"],
          }),
        );
      });
      const recipients = yield* auth.users.listUsersByEmails({
        query: { emails: `${email},missing@example.com` },
      });
      expect(recipients.data[0]?.email).toBe(email);
      expect(recipients.data[0]?.locale).toBe("fr");
      expect(recipients.missingEmails).toEqual(["missing@example.com"]);
    }),
  );

  it.effect("preserves authentication failures", () =>
    Effect.gen(function* () {
      const auth = yield* makeAuth((request) =>
        Effect.succeed(response(request, 401, { _tag: "Unauthorized" })),
      );
      const error = yield* auth.users
        .listUsersByEmails({ query: { emails: "missing@example.com" } })
        .pipe(Effect.flip);
      expect(error).toBeInstanceOf(HttpApiError.Unauthorized);
    }),
  );
});

describe("AuthService cookie session freshness", () => {
  const cookie = { cookie: "session=same-cookie" };
  const session = (activeOrganizationId: string | null) => ({
    user,
    session: {
      id: "session-1",
      token: "session-token",
      userId: user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt: "2026-01-02T00:00:00.000Z",
      activeOrganizationId,
    },
  });

  it.effect("returns the current user without looking up a missing organization", () =>
    Effect.gen(function* () {
      const auth = yield* makeAuth((request, url) => {
        if (url.pathname === "/api/users/user-1") {
          return Effect.succeed(response(request, 200, user));
        }
        expect(url.pathname).toBe("/api/auth/get-session");
        return Effect.succeed(response(request, 200, session(null)));
      }, cookie);
      const result = yield* requestIdentity(auth);
      expect(result.status).toBe(200);
      expect(yield* Effect.promise(() => result.json())).toEqual({
        user,
        organization: null,
      });
    }),
  );

  it.effect(
    "shares the lookup within a request but not across requests with the same cookie",
    () =>
      Effect.gen(function* () {
        let organization = "org-1";
        let lookups = 0;
        const makeRequestAuth = makeAuth(
          (request, url) => {
            expect(url.pathname).toBe("/api/auth/get-session");
            lookups++;
            return Effect.succeed(
              response(request, 200, session(organization)),
            );
          },
          cookie,
          true,
        );

        const firstRequest = yield* makeRequestAuth;
        const [firstSession, firstRequired] = yield* Effect.all(
          [firstRequest.getSession(), firstRequest.requireOrganization()],
          { concurrency: "unbounded" },
        );
        expect(firstSession?.session.activeOrganizationId).toBe("org-1");
        expect(firstRequired.session.activeOrganizationId).toBe("org-1");
        expect(lookups).toBe(1);

        organization = "org-2";
        const secondRequest = yield* makeRequestAuth;
        const current = yield* secondRequest.requireOrganization();
        expect(current.session.activeOrganizationId).toBe("org-2");
        expect(lookups).toBe(2);
      }),
  );

  it.effect("does not memoize on a shared service instance by default", () =>
    Effect.gen(function* () {
      let organization = "org-1";
      const auth = yield* makeAuth(
        (request) =>
          Effect.succeed(response(request, 200, session(organization))),
        cookie,
      );

      const first = yield* auth.requireOrganization();
      expect(first.session.activeOrganizationId).toBe("org-1");

      organization = "org-2";
      const current = yield* auth.requireOrganization();
      expect(current.session.activeOrganizationId).toBe("org-2");
    }),
  );
});

describe("AuthService session lookup failures", () => {
  it.effect("keeps an invalid verified API key Unauthorized", () =>
    expectSessionError(
      (request) =>
        Effect.succeed(
          response(request, 200, {
            valid: false,
            error: { message: "Invalid API key", code: "INVALID_API_KEY" },
            key: null,
          }),
        ),
      HttpApiError.Unauthorized,
    ),
  );

  it.effect("maps verifyApiKey upstream failures to ServiceUnavailable", () =>
    expectSessionError(
      (request) => Effect.succeed(response(request, 503)),
      HttpApiError.ServiceUnavailable,
    ),
  );

  it.effect("maps getUser upstream failures to ServiceUnavailable", () =>
    expectSessionError(
      (request) =>
        Effect.succeed(
          request.url.endsWith("/api/auth/verify-api-key")
            ? response(request, 200, {
                valid: true,
                error: null,
                key: verifiedUserKey,
              })
            : response(request, 503),
        ),
      HttpApiError.ServiceUnavailable,
    ),
  );

  it.effect(
    "maps active organization lookup failures to ServiceUnavailable",
    () =>
      expectSessionError(
        (request) =>
          Effect.succeed(
            request.url.endsWith("/api/auth/verify-api-key")
              ? response(request, 200, {
                  valid: true,
                  error: null,
                  key: verifiedUserKey,
                })
              : request.url.endsWith("/api/users/user-1")
                ? response(request, 200, user)
                : response(request, 503),
          ),
        HttpApiError.ServiceUnavailable,
      ),
  );

  it.effect("maps cookie session upstream failures to ServiceUnavailable", () =>
    expectSessionError(
      (request) => Effect.succeed(response(request, 503)),
      HttpApiError.ServiceUnavailable,
      { cookie: "session=invalid" },
    ),
  );

  it.effect("recovers after a transient auth outage", () =>
    Effect.gen(function* () {
      let unavailable = true;
      const auth = yield* makeAuth((request) => {
        if (unavailable) return Effect.succeed(response(request, 503));

        return Effect.succeed(
          request.url.endsWith("/api/auth/verify-api-key")
            ? response(request, 200, {
                valid: true,
                error: null,
                key: verifiedUserKey,
              })
            : request.url.endsWith("/api/users/user-1")
              ? response(request, 200, user)
              : response(request, 200, { id: "org-1" }),
        );
      });

      const error = yield* auth.getSession().pipe(Effect.flip);
      expect(error).toBeInstanceOf(HttpApiError.ServiceUnavailable);

      unavailable = false;
      const session = yield* auth.getSession();
      expect(session?.session.activeOrganizationId).toBe("org-1");
    }),
  );

  it.effect("uses an explicit organization for user API keys", () =>
    Effect.gen(function* () {
      const requestedUrls: string[] = [];
      const auth = yield* makeAuth(
        (request) => {
          requestedUrls.push(request.url);
          return Effect.succeed(
            request.url.endsWith("/api/auth/verify-api-key")
              ? response(request, 200, {
                  valid: true,
                  error: null,
                  key: verifiedUserKey,
                })
              : response(request, 200, user),
          );
        },
        {
          "x-api-key": "user_secret",
          "x-organization-id": "org-explicit",
        },
      );

      const session = yield* auth.getSession();
      expect(session?.session.activeOrganizationId).toBe("org-explicit");
      expect(
        requestedUrls.some((url) => url.includes("/organizations/user/")),
      ).toBe(false);
    }),
  );

  it.effect(
    "does not disclose an organization selected by a non-member API key owner",
    () =>
      Effect.gen(function* () {
        const auth = yield* makeAuth(
          (request, url) => {
            switch (url.pathname) {
              case "/api/auth/verify-api-key":
                return Effect.succeed(
                  response(request, 200, {
                    valid: true,
                    error: null,
                    key: verifiedUserKey,
                  }),
                );
              case "/api/users/user-1":
                return Effect.succeed(response(request, 200, user));
              default:
                expect(url.pathname).toBe(
                  "/api/organizations/other-org/members/user-1",
                );
                return Effect.succeed(
                  response(request, 404, { _tag: "NotFound" }),
                );
            }
          },
          { "x-api-key": "user_secret", "x-organization-id": "other-org" },
        );
        expect((yield* requestIdentity(auth)).status).toBe(403);
      }),
  );

  it.effect(
    "reflects an organization key without inventing a user or accepting an override",
    () =>
      Effect.gen(function* () {
        const auth = yield* makeAuth(
          (request, url) => {
            if (url.pathname === "/api/auth/verify-api-key") {
              return Effect.succeed(
                response(request, 200, {
                  valid: true,
                  error: null,
                  key: verifiedOrganizationKey,
                }),
              );
            }
            expect(url.pathname).toBe("/api/organizations/org-owned");
            return Effect.succeed(
              response(request, 200, {
                id: "org-owned",
                name: "Owned organization",
                slug: "owned",
                logo: null,
                metadata: null,
                parentId: null,
                createdAt: now,
              }),
            );
          },
          {
            "x-api-key": "organization_secret",
            "x-organization-id": "other-org",
          },
        );
        const result = yield* requestIdentity(auth);
        expect(result.status).toBe(200);
        expect(yield* Effect.promise(() => result.json())).toEqual({
          user: null,
          organization: {
            id: "org-owned",
            name: "Owned organization",
            slug: "owned",
            logo: null,
            metadata: { translations: [] },
            parentId: null,
            createdAt: now,
          },
        });
      }),
  );

  it.effect("does not override organization-owned API keys", () =>
    Effect.gen(function* () {
      let requestCount = 0;
      const auth = yield* makeAuth(
        (request) => {
          requestCount += 1;
          return Effect.succeed(
            response(request, 200, {
              valid: true,
              error: null,
              key: verifiedOrganizationKey,
            }),
          );
        },
        {
          "x-api-key": "organization_secret",
          "x-organization-id": "org-explicit",
        },
      );

      const session = yield* auth.getSession();
      expect(session?.session.activeOrganizationId).toBe("org-owned");
      expect(requestCount).toBe(1);
    }),
  );
});
