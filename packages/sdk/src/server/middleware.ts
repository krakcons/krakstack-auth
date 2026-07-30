import { Cause, Effect, Layer, Redacted } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import {
  HttpApiError,
  HttpApiMiddleware,
  HttpApiSecurity,
} from "effect/unstable/httpapi";

import { AuthService, type AuthServiceLayerOptions } from "../service";

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
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
  security: {
    apiKey: ApiKeySecurity,
  },
}) {
  static readonly layer = (
    options: AuthenticationLiveOptions | Layer.Layer<AuthService, unknown> = {},
  ) => makeAuthenticationLive(options);
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

const isAuthServiceLayer = (
  value: AuthenticationLiveOptions | Layer.Layer<AuthService, unknown>,
): value is Layer.Layer<AuthService, unknown> => Layer.isLayer(value);

export const makeAuthenticationLive = (
  options: AuthenticationLiveOptions | Layer.Layer<AuthService, unknown> = {},
) => {
  const legacyLayer = isAuthServiceLayer(options) ? options : undefined;
  const authOptions = isAuthServiceLayer(options) ? {} : options;
  const authLayer = legacyLayer ?? authOptions.authLayer;
  const allowedOrganizationImpersonationRoutes =
    authOptions.allowedOrganizationImpersonationRoutes ?? [];
  return Layer.effect(
    AuthMiddleware,
    Effect.gen(function* () {
      return {
        apiKey: (httpEffect, { credential }) =>
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            const apiKey = Redacted.value(credential).trim();
            const headers = apiKey
              ? { ...request.headers, "x-api-key": apiKey }
              : request.headers;
            const auth = yield* AuthService.pipe(
              Effect.provide(
                authLayer ??
                  AuthService.layer({
                    ...authOptions,
                    headers,
                  }),
              ),
              Effect.tapCause((cause) =>
                Effect.logError(
                  "Authentication rejected: auth client initialization failed",
                  Cause.pretty(cause),
                ),
              ),
              Effect.mapError(() => new HttpApiError.Unauthorized({})),
            );
            if (
              !isAllowedRoute(allowedOrganizationImpersonationRoutes, request)
            ) {
              const session = yield* auth
                .getSession()
                .pipe(
                  Effect.catchTag("Unauthorized", () => Effect.succeed(null)),
                );

              if (session?.session.impersonatedByOrganizationId) {
                return yield* new HttpApiError.Forbidden({});
              }
            }
            return auth;
          }).pipe(
            Effect.mapError((error) =>
              error instanceof HttpApiError.Unauthorized ||
              error instanceof HttpApiError.Forbidden
                ? error
                : new HttpApiError.Unauthorized({}),
            ),
            Effect.flatMap((auth) =>
              httpEffect.pipe(Effect.provideService(AuthService, auth)),
            ),
          ),
      };
    }),
  );
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
