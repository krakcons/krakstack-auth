import { Cause, Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi, FrontendApi } from "@/api";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { uploadImageFromMultipart } from "@/services/s3/upload";

import { OAuthClients } from ".";

const internalServerError = (error: unknown) => {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? Reflect.get(error, "cause")
      : null;
  console.error(
    "Failed to handle OAuth client request:",
    Cause.isCause(error)
      ? Cause.pretty(error)
      : Cause.isCause(cause)
        ? Cause.pretty(cause)
        : error,
  );
  return new HttpApiError.InternalServerError({});
};

export const publicOAuthClientsApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "publicOAuthClients",
  (handlers) =>
    handlers.handle("getOAuthClientConfig", ({ params }) =>
      Effect.gen(function* () {
        const clients = yield* OAuthClients;
        const config = yield* clients
          .getPublicConfig({ clientId: params.clientId })
          .pipe(Effect.mapError(internalServerError));

        if (!config) return yield* new HttpApiError.NotFound({});
        return config;
      }),
    ),
);

export const adminOAuthClientsApiHandler = HttpApiBuilder.group(
  AdminApi,
  "oauthClients",
  (handlers) =>
    handlers
      .handle("listOAuthClients", ({ request }) =>
        Effect.gen(function* () {
          const clients = yield* OAuthClients;
          return yield* clients
            .list()
            .pipe(Effect.provide(BetterAuthRequest.make(request)))
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createOAuthClient", ({ payload, request }) =>
        Effect.gen(function* () {
          const clients = yield* OAuthClients;
          return yield* clients
            .create({ payload })
            .pipe(Effect.provide(BetterAuthRequest.make(request)))
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("updateOAuthClient", ({ params, payload, request }) =>
        Effect.gen(function* () {
          const clients = yield* OAuthClients;
          const client = yield* clients
            .update({
              clientId: params.clientId,
              payload,
            })
            .pipe(Effect.provide(BetterAuthRequest.make(request)))
            .pipe(Effect.mapError(internalServerError));

          if (!client) return yield* new HttpApiError.NotFound({});
          return client;
        }),
      )
      .handle("deleteOAuthClient", ({ params, request }) =>
        Effect.gen(function* () {
          const clients = yield* OAuthClients;
          const client = yield* clients
            .delete({ clientId: params.clientId })
            .pipe(Effect.provide(BetterAuthRequest.make(request)))
            .pipe(Effect.mapError(internalServerError));

          if (!client) return yield* new HttpApiError.NotFound({});
          return client;
        }),
      )
      .handle("uploadOAuthClientLogo", ({ payload }) =>
        Effect.gen(function* () {
          const url = yield* uploadImageFromMultipart({
            payload,
            prefix: "logos/oauth-clients",
            fallbackFileName: "logo",
            badRequest: () => new HttpApiError.BadRequest({}),
            internalServerError,
          });

          return { url };
        }),
      ),
);
