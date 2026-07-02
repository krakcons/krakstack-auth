import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { FrontendApi } from "@/api";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { uploadImageFromMultipart } from "@/services/s3/upload";

import { AuthBadRequest } from "./schema";

const authError = (fallback: string) => (error: unknown) =>
  new AuthBadRequest({
    message: error instanceof Error ? error.message : fallback,
  });

const internalServerError = () => new HttpApiError.InternalServerError({});

const requestAuth = (
  request: HttpServerRequest.HttpServerRequest,
  fallback: string,
) =>
  BetterAuthRequest.pipe(
    Effect.provide(BetterAuthRequest.make(request)),
    Effect.mapError(authError(fallback)),
  );

const requestAuthSession = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const client = yield* BetterAuthRequest.pipe(
      Effect.provide(BetterAuthRequest.make(request)),
      Effect.mapError(internalServerError),
    );

    return yield* Effect.tryPromise({
      try: () => client.api.getSession({ headers: client.headers }),
      catch: internalServerError,
    });
  });

export const authApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "auth",
  (handlers) =>
    handlers
      .handle("setPassword", ({ payload, request }) =>
        Effect.gen(function* () {
          const client = yield* requestAuth(request, "Could not set password");
          yield* Effect.tryPromise({
            try: () =>
              client.api.setPassword({
                body: { newPassword: payload.newPassword },
                headers: client.headers,
              }),
            catch: authError("Could not set password"),
          });

          return { ok: true };
        }),
      )
      .handle("verifyPassword", ({ payload, request }) =>
        Effect.gen(function* () {
          const client = yield* requestAuth(
            request,
            "Could not verify password",
          );
          yield* Effect.tryPromise({
            try: () =>
              client.api.verifyPassword({
                body: { password: payload.password },
                headers: client.headers,
              }),
            catch: authError("Could not verify password"),
          });

          return { ok: true };
        }),
      )
      .handle("createApiKey", ({ payload, request }) =>
        Effect.gen(function* () {
          const client = yield* requestAuth(
            request,
            "Could not create API key",
          );
          const session = yield* Effect.tryPromise({
            try: () => client.api.getSession({ headers: client.headers }),
            catch: authError("Could not create API key"),
          });

          if (!session) {
            return yield* new AuthBadRequest({ message: "Unauthorized" });
          }

          const permissions = payload.permissions
            ? Object.fromEntries(
                Object.entries(payload.permissions).map(
                  ([resource, actions]) => [resource, Array.from(actions)],
                ),
              )
            : undefined;
          const result = yield* Effect.tryPromise({
            try: () =>
              client.api.createApiKey({
                body: {
                  configId: payload.configId,
                  userId: session.user.id,
                  ...(payload.name ? { name: payload.name } : {}),
                  ...(payload.organizationId
                    ? { organizationId: payload.organizationId }
                    : {}),
                  ...(permissions ? { permissions } : {}),
                },
              }),
            catch: authError("Could not create API key"),
          });

          return { id: result.id, key: result.key };
        }),
      )
      .handle("verifyApiKey", ({ payload, request }) =>
        Effect.gen(function* () {
          const client = yield* requestAuth(
            request,
            "Could not verify API key",
          );
          const permissions = payload.permissions
            ? Object.fromEntries(
                Object.entries(payload.permissions).map(
                  ([resource, actions]) => [resource, Array.from(actions)],
                ),
              )
            : undefined;
          const body = {
            key: payload.key,
            ...(payload.configId ? { configId: payload.configId } : {}),
            ...(permissions ? { permissions } : {}),
          };

          return yield* Effect.tryPromise({
            try: () =>
              client.api.verifyApiKey({ body, headers: client.headers }),
            catch: authError("Could not verify API key"),
          });
        }).pipe(
          Effect.map((result) => ({
            valid: result.valid,
            error: result.error
              ? {
                  code: result.error.code,
                  message: String(result.error.message ?? result.error.code),
                }
              : null,
            key: result.key
              ? {
                  id: result.key.id,
                  configId: result.key.configId,
                  name: result.key.name ?? null,
                  start: result.key.start ?? null,
                  prefix: result.key.prefix ?? null,
                  referenceId: result.key.referenceId,
                  enabled: result.key.enabled ?? null,
                  expiresAt: result.key.expiresAt ?? null,
                  createdAt: result.key.createdAt,
                  updatedAt: result.key.updatedAt,
                  permissions: result.key.permissions ?? null,
                  metadata: result.key.metadata ?? null,
                }
              : null,
          })),
        ),
      )
      .handle("uploadUserImage", ({ payload, request }) =>
        Effect.gen(function* () {
          const session = yield* requestAuthSession(request);

          if (!session) return yield* new HttpApiError.Unauthorized({});

          const url = yield* uploadImageFromMultipart({
            payload,
            prefix: `logos/users/${session.user.id}`,
            fallbackFileName: "profile-image",
            badRequest: (message) => new AuthBadRequest({ message }),
            internalServerError,
          });

          return { url };
        }),
      ),
);
