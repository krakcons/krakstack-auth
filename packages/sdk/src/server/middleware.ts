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
  static readonly layer = (
    options: AuthenticationLiveOptions | Layer.Layer<AuthService, unknown> = {},
  ) => makeAuthenticationLive(options);

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
  if (session.user) attributes["user.id"] = session.user.id;
  if (session.session.activeOrganizationId) {
    attributes["organization.id"] = session.session.activeOrganizationId;
  }
  if (session.authMethod.type === "cookie" && session.user) {
    attributes["app.actor.type"] = "user";
    attributes["app.actor.id"] = session.user.id;
  } else if (session.authMethod.type === "apiKey") {
    const key = session.authMethod.apiKey;
    attributes["app.actor.type"] = "api_key";
    attributes["app.actor.id"] = key.id;
    attributes["app.actor.owner.type"] = key.configId;
    attributes["app.actor.owner.id"] = key.referenceId;
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
