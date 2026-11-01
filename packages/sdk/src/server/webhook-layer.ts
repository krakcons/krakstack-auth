import { ByteSize, Config, Effect, Layer, Redacted, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { WebhooksReceiver } from "@krak-stack/registry/webhooks";
import type { AuthMiddlewareOptions } from "./middleware.js";
import type { AuthWebhook } from "../schema.js";
import {
  AuthWebhookCleanupError,
  AuthWebhookConfigurationError,
  receiveAuthWebhook,
} from "./webhooks.js";

export const makeAuthWebhookLayer = <E, R>(
  options: AuthMiddlewareOptions<E, R>,
) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const receiver = yield* WebhooksReceiver;
      const services = yield* Effect.context<R>();
      const projectId = yield* Schema.decodeUnknownEffect(
        Schema.NonEmptyString,
      )(
        options.projectId ??
          (yield* Config.NonEmptyString("VITE_KRAKSTACK_AUTH_PROJECT_ID")),
      );
      const secret =
        options.webhookSecret ??
        (yield* Config.Redacted("KRAKSTACK_AUTH_WEBHOOK_SECRET"));
      if (
        !Schema.is(Schema.String.check(Schema.isMinLength(32)))(
          Redacted.value(secret),
        )
      ) {
        return yield* new AuthWebhookConfigurationError({
          message:
            "The auth webhook signing secret must contain at least 32 characters",
        });
      }
      const onWebhook = options.onWebhook;
      const handle = Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.text;
        yield* receiveAuthWebhook({
          projectId,
          secret,
          body,
          headers: request.headers,
          onDeleteUser: (data) =>
            options.onDeleteUser(data).pipe(
              Effect.provideContext(services),
              Effect.mapError(() => new AuthWebhookCleanupError({})),
            ),
          onDeleteOrganization: (data) =>
            options.onDeleteOrganization(data).pipe(
              Effect.provideContext(services),
              Effect.mapError(() => new AuthWebhookCleanupError({})),
            ),
          onWebhook: onWebhook
            ? (webhook: typeof AuthWebhook.Type) =>
                onWebhook(webhook).pipe(
                  Effect.provideContext(services),
                  Effect.mapError(() => new AuthWebhookCleanupError({})),
                )
            : undefined,
        }).pipe(Effect.provideService(WebhooksReceiver, receiver));
        return HttpServerResponse.empty({ status: 204 });
      }).pipe(
        Effect.provideService(
          HttpServerRequest.MaxBodySize,
          ByteSize.kibibytes(16),
        ),
        Effect.catchTag("WebhookVerificationError", (error) =>
          Effect.succeed(
            HttpServerResponse.empty({
              status: error.reason === "payload" ? 400 : 401,
            }),
          ),
        ),
        Effect.catchTag("WebhookReceiptConflict", () =>
          Effect.succeed(HttpServerResponse.empty({ status: 409 })),
        ),
        Effect.catchTag("UnsupportedAuthWebhook", () =>
          Effect.succeed(HttpServerResponse.empty({ status: 400 })),
        ),
        Effect.catch(() =>
          Effect.succeed(HttpServerResponse.empty({ status: 500 })),
        ),
      );
      return HttpRouter.add("POST", "/api/webhooks/auth", handle);
    }),
  ).pipe(Layer.provide(WebhooksReceiver.layer));
