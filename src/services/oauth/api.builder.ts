import { Cause, Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { Api } from "@/api";
import { auth } from "@/services/auth/config";

import { OAuthClients } from ".";

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

export const oauthClientsApiHandler = HttpApiBuilder.group(
  Api,
  "oauthClients",
  (handlers) =>
    handlers
      .handle("listOAuthClients", ({ request }) =>
        Effect.gen(function* () {
          const session = yield* Effect.tryPromise({
            try: () => auth.api.getSession({ headers: request.headers }),
            catch: internalServerError,
          });

          if (!session) return yield* new HttpApiError.Unauthorized({});
          if (!hasAdminRole(userRole(session.user))) {
            return yield* new HttpApiError.Forbidden({});
          }

          const clients = yield* OAuthClients;
          return yield* clients
            .list()
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createOAuthClient", ({ payload, request }) =>
        Effect.gen(function* () {
          const session = yield* Effect.tryPromise({
            try: () => auth.api.getSession({ headers: request.headers }),
            catch: internalServerError,
          });

          if (!session) return yield* new HttpApiError.Unauthorized({});
          if (!hasAdminRole(userRole(session.user))) {
            return yield* new HttpApiError.Forbidden({});
          }

          const clients = yield* OAuthClients;
          return yield* clients
            .create({ payload })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("getOAuthClientConfig", ({ params }) =>
        Effect.gen(function* () {
          const clients = yield* OAuthClients;
          const config = yield* clients
            .getPublicConfig({ clientId: params.clientId })
            .pipe(Effect.mapError(internalServerError));

          if (!config) return yield* new HttpApiError.NotFound({});
          return config;
        }),
      )
      .handle("updateOAuthClient", ({ params, payload, request }) =>
        Effect.gen(function* () {
          const session = yield* Effect.tryPromise({
            try: () => auth.api.getSession({ headers: request.headers }),
            catch: internalServerError,
          });

          if (!session) return yield* new HttpApiError.Unauthorized({});
          if (!hasAdminRole(userRole(session.user))) {
            return yield* new HttpApiError.Forbidden({});
          }

          const clients = yield* OAuthClients;
          const client = yield* clients
            .update({ clientId: params.clientId, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!client) return yield* new HttpApiError.NotFound({});
          return client;
        }),
      ),
);
