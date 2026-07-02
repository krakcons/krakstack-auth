import { Cause, Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { FrontendApi } from "@/api";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { uploadImageFromMultipart } from "@/services/s3/upload";

const internalServerError = (error: unknown) => {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? Reflect.get(error, "cause")
      : null;
  console.error(
    "Failed to handle organization request:",
    Cause.isCause(error)
      ? Cause.pretty(error)
      : Cause.isCause(cause)
        ? Cause.pretty(cause)
        : error,
  );
  return new HttpApiError.InternalServerError({});
};

const currentSession = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const betterAuth = yield* BetterAuthRequest.pipe(
      Effect.provide(BetterAuthRequest.make(request)),
      Effect.mapError(internalServerError),
    );
    return yield* Effect.tryPromise({
      try: () => betterAuth.api.getSession({ headers: betterAuth.headers }),
      catch: internalServerError,
    });
  });

const bearerToken = (value: string | undefined) => {
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
};

const requireServiceApiKey = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const key =
      bearerToken(request.headers.authorization) ??
      request.headers["x-api-key"];
    if (!key) return yield* new HttpApiError.Unauthorized({});

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

    if (!result.valid) return yield* new HttpApiError.Unauthorized({});
  });

const requireSessionOrService = (
  request: HttpServerRequest.HttpServerRequest,
) =>
  requireServiceApiKey(request).pipe(
    Effect.catchTag("Unauthorized", () =>
      currentSession(request).pipe(
        Effect.flatMap((session) =>
          session ? Effect.void : new HttpApiError.Unauthorized({}),
        ),
      ),
    ),
  );

export const organizationsApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "organizations",
  (handlers) =>
    handlers.handle("uploadOrganizationLogo", ({ payload, request }) =>
      Effect.gen(function* () {
        yield* requireSessionOrService(request);

        const url = yield* uploadImageFromMultipart({
          payload,
          prefix: "logos/organizations",
          fallbackFileName: "logo",
          badRequest: () => new HttpApiError.BadRequest({}),
          internalServerError,
        });

        return { url };
      }),
    ),
);
