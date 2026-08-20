import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";

import { AuthClientConfig } from "./config";
import { AuthService } from "./service";

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
  body?: unknown,
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
) =>
  AuthService.make({ headers, apiKeyConfigId: "user" }).pipe(
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
    | typeof HttpApiError.Unauthorized
    | typeof HttpApiError.ServiceUnavailable,
  headers?: Record<string, string>,
) =>
  Effect.gen(function* () {
    const auth = yield* makeAuth(handler, headers);
    const error = yield* auth.getSession().pipe(Effect.flip);

    expect(error).toBeInstanceOf(ErrorClass);
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
