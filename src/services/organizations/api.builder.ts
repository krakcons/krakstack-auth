import { Cause, Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { FrontendApi } from "@/api";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { S3Service } from "@/services/s3";
import { s3AssetUrl } from "@/services/s3/asset-url";

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

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "logo";

export const organizationsApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "organizations",
  (handlers) =>
    handlers.handle("presignOrganizationLogoUpload", ({ payload, request }) =>
      Effect.gen(function* () {
        yield* requireSessionOrService(request);

        if (!payload.contentType.startsWith("image/")) {
          return yield* new HttpApiError.BadRequest({});
        }

        const s3 = yield* S3Service;
        const key = `logos/organizations/${crypto.randomUUID()}-${safeFileName(payload.fileName)}`;
        const uploadUrl = yield* s3
          .presign(key, {
            expiresIn: 300,
            method: "PUT",
            type: payload.contentType,
          })
          .pipe(Effect.mapError(internalServerError));

        return { uploadUrl, url: s3AssetUrl(key) };
      }),
    ),
);
