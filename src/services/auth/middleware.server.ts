import { Effect, Layer, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";

import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import {
  apiKeyAllowedOrigins,
  requestMatchesAllowedOrigins,
} from "@/services/auth/api-key-referrers";
import {
  AdminAuthMiddleware,
  ServiceApiKeyMiddleware,
  ServiceApiKeyUnauthorized,
} from "@/services/auth/middleware";

const userRole = (value: unknown) => {
  if (typeof value !== "object" || value === null || !("role" in value)) {
    return undefined;
  }
  return Reflect.get(value, "role");
};

const hasAdminRole = (role: unknown) =>
  typeof role === "string" &&
  role.split(",").some((item) => item.trim() === "admin");

const internalServerError = (error: unknown) => {
  console.error("Failed to authorize API request:", error);
  return new HttpApiError.InternalServerError({});
};

const bearerToken = (value: string | undefined) => {
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
};

const serviceApiKey = (headers: Headers.Headers) =>
  bearerToken(Option.getOrUndefined(Headers.get(headers, "authorization"))) ??
  Option.getOrUndefined(Headers.get(headers, "x-api-key"));

export const adminAuthMiddlewareLayer = Layer.succeed(
  AdminAuthMiddleware,
  (effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const betterAuth = yield* BetterAuthRequest.pipe(
        Effect.provide(BetterAuthRequest.make(request)),
        Effect.mapError(internalServerError),
      );
      const session = yield* Effect.tryPromise({
        try: () => betterAuth.api.getSession({ headers: betterAuth.headers }),
        catch: internalServerError,
      });

      if (!session) return yield* new HttpApiError.Unauthorized({});
      if (session.session.impersonatedByOrganizationId) {
        return yield* new HttpApiError.Forbidden({});
      }
      if (!hasAdminRole(userRole(session.user))) {
        return yield* new HttpApiError.Forbidden({});
      }

      return yield* effect;
    }),
);

export const serviceApiKeyMiddlewareLayer = Layer.succeed(
  ServiceApiKeyMiddleware,
  (effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const key = serviceApiKey(request.headers);
      if (!key) {
        return yield* new ServiceApiKeyUnauthorized({
          message: "A service API key is required.",
        });
      }

      const betterAuth = yield* BetterAuthRequest.pipe(
        Effect.provide(BetterAuthRequest.make(request)),
        Effect.mapError(internalServerError),
      );
      const result = yield* Effect.tryPromise({
        try: () =>
          betterAuth.api.verifyApiKey({
            body: { key, configId: "service" },
            headers: betterAuth.headers,
          }),
        catch: internalServerError,
      });

      if (!result.valid || !result.key) {
        return yield* new ServiceApiKeyUnauthorized({
          message: "The service API key is invalid, disabled, or expired.",
        });
      }

      const allowedOrigins = apiKeyAllowedOrigins(result.key.metadata);
      const origin = Option.getOrUndefined(
        Headers.get(request.headers, "origin"),
      );
      const referrer = Option.getOrUndefined(
        Headers.get(request.headers, "referer"),
      );
      if (!requestMatchesAllowedOrigins(origin, referrer, allowedOrigins)) {
        return yield* new ServiceApiKeyUnauthorized({
          message: "The API key is not allowed from this referrer.",
        });
      }

      return yield* effect;
    }),
);
