import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "@/api";
import { auth } from "@/services/auth/config";

import { AuthBadRequest } from "./schema";

const authError = (fallback: string) => (error: unknown) =>
  new AuthBadRequest({
    message: error instanceof Error ? error.message : fallback,
  });

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
    ),
);
