import { Effect, Layer, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";

import { authForRequest } from "@/services/auth/config";
import {
  AdminAuthMiddleware,
  ServiceApiKeyMiddleware,
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
      const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
        Effect.mapError(internalServerError),
      );
      const session = yield* Effect.tryPromise({
        try: async () =>
          (await authForRequest(webRequest)).api.getSession({
            headers: webRequest.headers,
          }),
        catch: internalServerError,
      });

      if (!session) return yield* new HttpApiError.Unauthorized({});
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
      if (!key) return yield* new HttpApiError.Unauthorized({});

      const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
        Effect.mapError(internalServerError),
      );
      const result = yield* Effect.tryPromise({
        try: async () =>
          (await authForRequest(webRequest)).api.verifyApiKey({
            body: { key, configId: "service" },
            headers: webRequest.headers,
          }),
        catch: internalServerError,
      });

      if (!result.valid) return yield* new HttpApiError.Unauthorized({});

      return yield* effect;
    }),
);
