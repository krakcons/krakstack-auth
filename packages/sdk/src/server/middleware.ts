import {
  ByteSize,
  Cause,
  Config,
  Effect,
  Layer,
  Redacted,
  Schema,
} from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { WebhooksReceiver } from "@krak-stack/registry/webhooks";
import {
  HttpApiError,
  HttpApiMiddleware,
  HttpApiSecurity,
} from "effect/http-api";

import {
  AuthService,
  type AuthServiceLayerOptions,
  type AuthSession,
} from "../service.js";
import { AuthClientConfig } from "../config.js";
import { withAuthAnnotations } from "./attribution.js";
import {
  AccountDeletionData,
  AuthWebhook,
  AuthWebhookCleanupError,
  AuthWebhookConfigurationError,
  receiveAuthWebhook,
} from "./webhooks.js";

export const ApiKeySecurity = HttpApiSecurity.apiKey({
  key: "x-api-key",
  in: "header",
});

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  {
    provides: AuthService;
    security: {
      apiKey: typeof ApiKeySecurity;
    };
  }
>()("@krak-stack/auth/AuthMiddleware", {
  error: [
    HttpApiError.Unauthorized,
    HttpApiError.Forbidden,
    HttpApiError.ServiceUnavailable,
  ],
  security: {
    apiKey: ApiKeySecurity,
  },
}) {
  static readonly layer = <E, R>(options: AuthMiddlewareOptions<E, R>) =>
    Layer.merge(
      makeAuthenticationLive(options),
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
              onWebhook: onWebhook ? (webhook: typeof AuthWebhook.Type) => onWebhook(webhook).pipe(
                Effect.provideContext(services),
                Effect.mapError(() => new AuthWebhookCleanupError({})),
              ) : undefined,
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
            Effect.catchTag("UnsupportedAuthWebhook", () => Effect.succeed(HttpServerResponse.empty({ status: 400 }))),
            Effect.catch(() =>
              Effect.succeed(HttpServerResponse.empty({ status: 500 })),
            ),
          );
          return HttpRouter.add("POST", "/api/webhooks/auth", handle);
        }),
      ),
    ).pipe(Layer.provide(WebhooksReceiver.layer));

  /** The same optional authentication and attribution for plain HttpRouter routes. */
  static readonly routerLayer = (options: AuthRouterOptions = {}) =>
    HttpRouter.middleware(
      Effect.gen(function* () {
        const config = options.authLayer
          ? undefined
          : yield* AuthClientConfig.make(options);
        return (httpEffect) =>
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            if (
              options.paths &&
              !options.paths.includes(pathnameFromUrl(request.url))
            ) {
              return yield* httpEffect;
            }
            const { auth, session } = yield* authenticateRequest(
              { ...options, ...config },
              options.authLayer,
            );
            return yield* withAuthAnnotations(
              httpEffect.pipe(Effect.provideService(AuthService, auth)),
              sessionAnnotations(session),
            );
          });
      }),
    ).layer;
}

export type AuthenticationLiveOptions = AuthServiceLayerOptions & {
  readonly allowedOrganizationImpersonationRoutes?: readonly {
    readonly method: string;
    readonly path: string;
  }[];
  readonly authLayer?: Layer.Layer<
    AuthService,
    unknown,
    HttpServerRequest.HttpServerRequest
  >;
};

export type AuthMiddlewareOptions<E, R> = AuthenticationLiveOptions & {
  readonly projectId?: string;
  readonly webhookSecret?: Redacted.Redacted<string>;
  readonly onDeleteUser: (
    data: typeof AccountDeletionData.Type,
  ) => Effect.Effect<void, E, R>;
  readonly onWebhook?: (webhook: typeof AuthWebhook.Type) => Effect.Effect<void, E, R>;
};

export type AuthRouterOptions = AuthenticationLiveOptions & {
  /** Resolve auth only for these exact URL pathnames. Defaults to every route in scope. */
  readonly paths?: readonly string[];
};

const isAuthServiceLayer = (
  value: AuthenticationLiveOptions | Layer.Layer<AuthService, unknown>,
): value is Layer.Layer<AuthService, unknown> => Layer.isLayer(value);

export const makeAuthenticationLive = (
  options: AuthenticationLiveOptions | Layer.Layer<AuthService, unknown> = {},
) => {
  const legacyLayer = isAuthServiceLayer(options) ? options : undefined;
  const authOptions = isAuthServiceLayer(options) ? {} : options;
  const authLayer = legacyLayer ?? authOptions.authLayer;
  return Layer.effect(
    AuthMiddleware,
    Effect.gen(function* () {
      return {
        apiKey: (httpEffect, { credential }) =>
          authenticateRequest(
            authOptions,
            authLayer,
            Redacted.value(credential).trim(),
          ).pipe(
            Effect.flatMap(({ auth, session }) =>
              withAuthAnnotations(
                httpEffect.pipe(Effect.provideService(AuthService, auth)),
                sessionAnnotations(session),
              ),
            ),
          ),
      };
    }),
  );
};

const authenticateRequest = Effect.fnUntraced(function* (
  options: AuthenticationLiveOptions,
  authLayer: AuthenticationLiveOptions["authLayer"],
  apiKey?: string,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const auth = yield* AuthService.pipe(
    Effect.provide(
      authLayer ??
        AuthService.layer({
          ...options,
          headers: apiKey
            ? { ...request.headers, "x-api-key": apiKey }
            : request.headers,
        }),
    ),
    Effect.tapCause((cause) =>
      Effect.logError(
        "Authentication rejected: auth client initialization failed",
        Cause.pretty(cause),
      ),
    ),
    Effect.mapError(() => new HttpApiError.ServiceUnavailable({})),
  );
  const session = yield* auth
    .getSession()
    .pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null)));
  if (
    session?.session.impersonatedByOrganizationId &&
    !isAllowedRoute(
      options.allowedOrganizationImpersonationRoutes ?? [],
      request,
    )
  ) {
    return yield* new HttpApiError.Forbidden({});
  }
  return { auth, session };
});

const sessionAnnotations = (session: AuthSession | null) => {
  const attributes: Record<string, string> = {};
  if (!session) return attributes;
  if (
    session.user &&
    (session.authMethod.type === "cookie" ||
      session.authMethod.apiKey.configId === "user")
  ) {
    attributes["user.id"] = session.user.id;
    attributes["user.full_name"] = session.user.name;
    attributes["user.email"] = session.user.email;
  }
  if (session.session.activeOrganizationId) {
    attributes["organization.id"] = session.session.activeOrganizationId;
  }
  if (session.authMethod.type === "cookie" && session.user) {
    attributes["app.actor.type"] = "user";
    attributes["app.actor.id"] = session.user.id;
    attributes["app.auth.method"] = "session";
    if (session.session.impersonatedBy) {
      attributes["app.auth.impersonator.id"] = session.session.impersonatedBy;
    }
  } else if (session.authMethod.type === "apiKey") {
    const key = session.authMethod.apiKey;
    attributes["app.actor.type"] = key.configId;
    attributes["app.actor.id"] = key.referenceId;
    attributes["app.auth.method"] = "api_key";
    attributes["app.auth.credential.id"] = key.id;
  }
  return attributes;
};

const pathnameFromUrl = (url: string) =>
  new URL(url, "http://localhost").pathname;

const isAllowedRoute = (
  routes: readonly { readonly method: string; readonly path: string }[],
  request: HttpServerRequest.HttpServerRequest,
) =>
  routes.some(
    ({ method, path }) =>
      method.toUpperCase() === request.method.toUpperCase() &&
      routePathMatches(path, pathnameFromUrl(request.url)),
  );

const routePathMatches = (allowedPath: string, requestPath: string) => {
  if (allowedPath === requestPath) return true;

  const allowedSegments = allowedPath.split("/").filter(Boolean);
  const requestSegments = requestPath.split("/").filter(Boolean);
  if (allowedSegments.length !== requestSegments.length) return false;

  return allowedSegments.every(
    (segment, index) =>
      segment.startsWith(":") || segment === requestSegments[index],
  );
};
