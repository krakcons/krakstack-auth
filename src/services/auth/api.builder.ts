import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { Api } from "@/api";
import { auth } from "@/services/auth/config";
import { S3Service } from "@/services/s3";

import { AuthBadRequest } from "./schema";

const authError = (fallback: string) => (error: unknown) =>
  new AuthBadRequest({
    message: error instanceof Error ? error.message : fallback,
  });

const internalServerError = () => new HttpApiError.InternalServerError({});

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile-image";

const assetUrl = (key: string) =>
  `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;

export const authApiHandler = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handle("setPassword", ({ payload, request }) =>
      Effect.tryPromise({
        try: () =>
          auth.api.setPassword({
            body: { newPassword: payload.newPassword },
            headers: request.headers,
          }),
        catch: authError("Could not set password"),
      }).pipe(Effect.map(() => ({ ok: true }))),
    )
    .handle("verifyPassword", ({ payload, request }) =>
      Effect.tryPromise({
        try: () =>
          auth.api.verifyPassword({
            body: { password: payload.password },
            headers: request.headers,
          }),
        catch: authError("Could not verify password"),
      }).pipe(Effect.map(() => ({ ok: true }))),
    )
    .handle("createApiKey", ({ payload, request }) =>
      Effect.tryPromise({
        try: async () => {
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (!session) {
            throw new Error("Unauthorized");
          }

          const permissions = payload.permissions
            ? Object.fromEntries(
                Object.entries(payload.permissions).map(
                  ([resource, actions]) => [resource, Array.from(actions)],
                ),
              )
            : undefined;
          const result = await auth.api.createApiKey({
            body: {
              configId: payload.configId,
              userId: session.user.id,
              ...(payload.name ? { name: payload.name } : {}),
              ...(payload.organizationId
                ? { organizationId: payload.organizationId }
                : {}),
              ...(permissions ? { permissions } : {}),
            },
          });

          return { id: result.id, key: result.key };
        },
        catch: authError("Could not create API key"),
      }),
    )
    .handle("verifyApiKey", ({ payload }) =>
      Effect.tryPromise({
        try: () => {
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

          return auth.api.verifyApiKey({ body });
        },
        catch: authError("Could not verify API key"),
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
    .handle("presignUserImageUpload", ({ payload, request }) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => auth.api.getSession({ headers: request.headers }),
          catch: internalServerError,
        });

        if (!session) return yield* new HttpApiError.Unauthorized({});

        if (!payload.contentType.startsWith("image/")) {
          return yield* new AuthBadRequest({
            message: "Only image uploads are supported",
          });
        }

        const s3 = yield* S3Service;
        const key = `logos/users/${session.user.id}/${crypto.randomUUID()}-${safeFileName(payload.fileName)}`;
        const uploadUrl = yield* s3
          .presign(key, {
            expiresIn: 300,
            method: "PUT",
            type: payload.contentType,
          })
          .pipe(Effect.mapError(internalServerError));

        return { uploadUrl, url: assetUrl(key) };
      }),
    ),
);
