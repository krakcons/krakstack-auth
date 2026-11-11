import { Cause, Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";
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
import type {
  AccountDeletionData,
  OrganizationDeletionData,
  AuthWebhook,
} from "../schema.js";

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
        // API contracts also import this class in the browser. Load persistence
        // only when the server acquires its implementation layer.
        Effect.promise(() => import("./webhook-layer.js")).pipe(
          Effect.map(({ makeAuthWebhookLayer }) =>
            makeAuthWebhookLayer(options),
          ),
        ),
      ),
    );

  /** The same optional authentication and attribution for plain HttpRouter routes. */
  static readonly routerLayer = <E>(options: AuthRouterOptions<E> = {}) =>
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

export type AuthenticationLiveOptions<E = unknown> = AuthServiceLayerOptions & {
  readonly allowedOrganizationImpersonationRoutes?: readonly {
    readonly method: string;
    readonly path: string;
  }[];
  readonly authLayer?: Layer.Layer<
    AuthService,
    E,
    HttpServerRequest.HttpServerRequest
  >;
};

export type AuthMiddlewareOptions<E, R> = AuthenticationLiveOptions & {
  readonly projectId?: string;
  readonly webhookSecret?: Redacted.Redacted<string>;
  readonly onDeleteUser: (
    data: typeof AccountDeletionData.Type,
  ) => Effect.Effect<void, E, R>;
  readonly onDeleteOrganization: (
    data: typeof OrganizationDeletionData.Type,
  ) => Effect.Effect<void, E, R>;
  readonly onWebhook?: (
    webhook: typeof AuthWebhook.Type,
  ) => Effect.Effect<void, E, R>;
};

export type AuthRouterOptions<E = unknown> = AuthenticationLiveOptions<E> & {
  /** Resolve auth only for these exact URL pathnames. Defaults to every route in scope. */
  readonly paths?: readonly string[];
};

const isAuthServiceLayer = <E>(
  value: AuthenticationLiveOptions<E> | Layer.Layer<AuthService, E>,
): value is Layer.Layer<AuthService, E> => Layer.isLayer(value);

export const makeAuthenticationLive = <E>(
  options: AuthenticationLiveOptions<E> | Layer.Layer<AuthService, E> = {},
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

const authenticateRequest = Effect.fnUntraced(function* <E>(
  options: AuthenticationLiveOptions<E>,
  authLayer: AuthenticationLiveOptions<E>["authLayer"],
  apiKey?: string,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const resolvedAuthLayer: Layer.Layer<
    AuthService,
    E | Layer.Error<ReturnType<typeof AuthService.layer>>,
    HttpServerRequest.HttpServerRequest
  > =
    authLayer ??
    AuthService.layer({
      ...options,
      headers: apiKey
        ? { ...request.headers, "x-api-key": apiKey }
        : request.headers,
    });
  const auth = yield* AuthService.pipe(
    Effect.provide(resolvedAuthLayer),
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
    session?.authMethod.type === "oauth" &&
    (!(options.oauth?.allowedMethods ?? ["GET", "HEAD"]).includes(
      request.method,
    ) ||
      (!["GET", "HEAD"].includes(request.method) &&
        !session.authMethod.scopes.includes(
          options.oauth?.writeScope ?? "mcp:write",
        )))
  )
    return yield* new HttpApiError.Forbidden({});
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
    (session.authMethod.type !== "apiKey" ||
      session.authMethod.apiKey.configId === "user")
  ) {
    attributes["user.id"] = session.user.id;
    attributes["user.full_name"] = session.user.name;
    attributes["user.email"] = session.user.email;
  }
  if (session.session.activeOrganizationId) {
    attributes["organization.id"] = session.session.activeOrganizationId;
  }
  if (session.authMethod.type !== "apiKey" && session.user) {
    attributes["app.actor.type"] = "user";
    attributes["app.actor.id"] = session.user.id;
    attributes["app.auth.method"] =
      session.authMethod.type === "oauth" ? "oauth" : "session";
    if (session.authMethod.type === "oauth") {
      attributes["app.auth.client.id"] = session.authMethod.clientId;
    }
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
