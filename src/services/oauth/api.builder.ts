import { Cause, Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { Api } from "@/api";
import { auth } from "@/services/auth/config";
import { S3Service } from "@/services/s3";
import { s3AssetUrl } from "@/services/s3/asset-url";

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

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "logo";

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
            .list({ headers: request.headers })
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
            .create({ headers: request.headers, payload })
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
            .update({
              clientId: params.clientId,
              headers: request.headers,
              payload,
            })
            .pipe(Effect.mapError(internalServerError));

          if (!client) return yield* new HttpApiError.NotFound({});
          return client;
        }),
      )
      .handle("deleteOAuthClient", ({ params, request }) =>
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
            .delete({ clientId: params.clientId, headers: request.headers })
            .pipe(Effect.mapError(internalServerError));

          if (!client) return yield* new HttpApiError.NotFound({});
          return client;
        }),
      )
      .handle("presignOAuthClientLogoUpload", ({ payload, request }) =>
        Effect.gen(function* () {
          const session = yield* Effect.tryPromise({
            try: () => auth.api.getSession({ headers: request.headers }),
            catch: internalServerError,
          });

          if (!session) return yield* new HttpApiError.Unauthorized({});
          if (!hasAdminRole(userRole(session.user))) {
            return yield* new HttpApiError.Forbidden({});
          }

          if (!payload.contentType.startsWith("image/")) {
            return yield* new HttpApiError.BadRequest({});
          }

          const s3 = yield* S3Service;
          const key = `logos/oauth-clients/${crypto.randomUUID()}-${safeFileName(payload.fileName)}`;
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
