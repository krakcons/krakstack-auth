import { Cause, Effect, Option } from "effect";
import { Headers } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { auth } from "@/services/auth/config";

import { BackendAuth } from ".";
import { BackendAuthApi } from "./api.group";

const internalServerError = (error: unknown) => {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? Reflect.get(error, "cause")
      : null;
  console.error(
    "Failed to handle backend auth request:",
    Cause.isCause(error)
      ? Cause.pretty(error)
      : Cause.isCause(cause)
        ? Cause.pretty(cause)
        : error,
  );
  return new HttpApiError.InternalServerError({});
};

const bearerToken = (value: string | undefined) => {
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
};

const serviceApiKey = (headers: Headers.Headers) =>
  bearerToken(Option.getOrUndefined(Headers.get(headers, "authorization"))) ??
  Option.getOrUndefined(Headers.get(headers, "x-api-key"));

const requireServiceApiKey = (headers: Headers.Headers) =>
  Effect.gen(function* () {
    const key = serviceApiKey(headers);
    if (!key) return yield* new HttpApiError.Unauthorized({});

    const result = yield* Effect.tryPromise({
      try: () => auth.api.verifyApiKey({ body: { key, configId: "service" } }),
      catch: internalServerError,
    });

    if (!result.valid) return yield* new HttpApiError.Unauthorized({});
  });

const parseIds = (ids: string) =>
  ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

export const backendAuthApiHandler = HttpApiBuilder.group(
  BackendAuthApi,
  "backendAuth",
  (handlers) =>
    handlers
      .handle("listUsersByIds", ({ query, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          return yield* backendAuth
            .listUsersByIds({ ids: parseIds(query.ids) })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("listOrganizationsByIds", ({ query, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          return yield* backendAuth
            .listOrganizationsByIds({ ids: parseIds(query.ids) })
            .pipe(Effect.mapError(internalServerError));
        }),
      ),
);
