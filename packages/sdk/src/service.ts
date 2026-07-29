import {
  Cache,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Redacted,
} from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { HttpApiError } from "effect/unstable/httpapi";

import { AuthServiceApi } from "./api";
import { AuthClientConfig, type ClientConfig } from "./config";
import { ExtraVerifiedApiKey } from "./extra/schema";
import type { GetSessionResponse } from "./better-auth/api.group";
import type { Session, User } from "./schema";

type ExtraVerifiedApiKeyType = typeof ExtraVerifiedApiKey.Type;

export type AuthSession = {
  readonly session: Session;
  readonly user: User | undefined;
  readonly isSuperAdminImpersonation: false;
  readonly authMethod:
    | { readonly type: "cookie" }
    | {
        readonly type: "apiKey";
        readonly apiKey: ExtraVerifiedApiKeyType;
      };
};

export type AuthSessionWithOrganization = AuthSession & {
  readonly session: Session & { readonly activeOrganizationId: string };
};

export type AuthSessionWithUser = AuthSession & {
  readonly user: User;
};

export type AuthSessionWithUserAndOrganization = AuthSessionWithUser &
  AuthSessionWithOrganization;

export type AuthServiceLayerOptions = Partial<ClientConfig> & {
  readonly headers?: Record<string, string>;
  readonly apiKeyConfigId?: "user" | "organization" | "service";
};

const forwardedAuthHeaderNames = [
  "accept-language",
  "cookie",
  "origin",
  "referer",
  "user-agent",
] as const;

const forwardedAuthHeaders = (headers: Record<string, string>) => {
  const normalizedHeaders: Record<string, string> = {};
  const forwarded: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  for (const name of forwardedAuthHeaderNames) {
    const value = normalizedHeaders[name];
    if (value) forwarded[name] = value;
  }

  return forwarded;
};

const authHttpClientLayer = (headers: Record<string, string>) =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient;

      return HttpClient.mapRequest(http, (request) =>
        HttpClientRequest.setHeaders(request, forwardedAuthHeaders(headers)),
      );
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));

const getSessionCacheKey = (headers: Record<string, string>) =>
  JSON.stringify(forwardedAuthHeaders(headers));

const headerValue = (headers: Record<string, string>, name: string) => {
  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === lowerName,
  );

  return entry?.[1];
};

const unauthorized = () => new HttpApiError.Unauthorized({});

const withRequiredOrganization = <A extends AuthSession>(
  authSession: A,
): Effect.Effect<
  A & AuthSessionWithOrganization,
  HttpApiError.Unauthorized
> => {
  const activeOrganizationId = authSession.session.activeOrganizationId;

  return activeOrganizationId
    ? Effect.succeed({
        ...authSession,
        session: { ...authSession.session, activeOrganizationId },
      })
    : Effect.fail(unauthorized());
};

const isBetterAuthSessionRequest = (
  request: HttpClientRequest.HttpClientRequest,
) => request.url.endsWith("/api/auth/get-session");

class SessionLookup extends Context.Service<
  SessionLookup,
  { readonly getSession: () => Effect.Effect<GetSessionResponse, unknown> }
>()("@krak-stack/auth/SessionLookup") {}

const sessionCache = Effect.runSync(
  Cache.makeWith<string, GetSessionResponse, unknown, SessionLookup, "lookup">(
    () =>
      Effect.gen(function* () {
        const lookup = yield* SessionLookup;
        return yield* lookup.getSession();
      }),
    {
      capacity: 500,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) ? Duration.seconds(2) : Duration.zero,
      requireServicesAt: "lookup",
    },
  ),
);

export class AuthService extends Context.Service<AuthService>()(
  "@krak-stack/auth/AuthService",
  {
    make: (options: AuthServiceLayerOptions = {}) =>
      Effect.gen(function* () {
        const headers = options.headers ?? {};
        const apiKeyConfigId = options.apiKeyConfigId;
        const config = yield* AuthClientConfig;
        const http = yield* HttpClient.HttpClient;
        const httpClient = HttpClient.mapRequest(http, (request) =>
          isBetterAuthSessionRequest(request)
            ? request
            : HttpClientRequest.bearerToken(
                request,
                Redacted.value(config.apiKey),
              ),
        );

        const api = yield* HttpApiClient.makeWith(AuthServiceApi, {
          baseUrl: config.baseUrl,
          httpClient,
        });
        const sessionCacheKey = getSessionCacheKey(headers);
        const apiKey = headerValue(headers, "x-api-key")?.trim();

        const getCookieSession = (): Effect.Effect<
          AuthSession | null,
          HttpApiError.Unauthorized,
          never
        > =>
          Cache.get(sessionCache, sessionCacheKey).pipe(
            Effect.provideService(SessionLookup, {
              getSession: api.auth.getSession,
            }),
            Effect.mapError(unauthorized),
            Effect.map((authSession) =>
              authSession
                ? ({
                    ...authSession,
                    isSuperAdminImpersonation: false as const,
                    authMethod: { type: "cookie" as const },
                  } satisfies AuthSession)
                : null,
            ),
          );

        const userForApiKey = (
          verifiedKey: ExtraVerifiedApiKeyType,
        ): Effect.Effect<User | undefined, HttpApiError.Unauthorized> => {
          if (verifiedKey.configId === "organization") {
            return Effect.succeed(undefined);
          }

          return api.users
            .getUser({ params: { id: verifiedKey.referenceId } })
            .pipe(Effect.mapError(unauthorized));
        };

        const activeOrganizationIdForApiKey = (
          verifiedKey: ExtraVerifiedApiKeyType,
          user: User | undefined,
        ): Effect.Effect<{ id: string | null }, never> => {
          if (verifiedKey.configId === "organization") {
            return Effect.succeed({ id: verifiedKey.referenceId });
          }

          if (!user) return Effect.succeed({ id: null });

          return api.users
            .getUserActiveOrganization({ params: { userId: user.id } })
            .pipe(Effect.catch(() => Effect.succeed({ id: null })));
        };

        const getApiKeySession = (
          key: string,
        ): Effect.Effect<AuthSession, HttpApiError.Unauthorized, never> =>
          Effect.gen(function* () {
            const verified = yield* api.authExtra
              .verifyApiKey({
                payload: {
                  key,
                  ...(apiKeyConfigId ? { configId: apiKeyConfigId } : {}),
                },
              })
              .pipe(Effect.mapError(unauthorized));

            if (!verified.valid || !verified.key) {
              return yield* Effect.fail(unauthorized());
            }

            const user = yield* userForApiKey(verified.key);
            const activeOrganization = yield* activeOrganizationIdForApiKey(
              verified.key,
              user,
            );
            const now = new Date();

            return {
              session: {
                id: `api-key:${verified.key.id}`,
                token: verified.key.id,
                userId: user?.id ?? `api-key:${verified.key.id}`,
                activeOrganizationId: activeOrganization.id,
                createdAt: now,
                updatedAt: now,
                expiresAt:
                  verified.key.expiresAt ?? new Date(now.getTime() + 3600000),
              },
              user,
              isSuperAdminImpersonation: false as const,
              authMethod: {
                type: "apiKey" as const,
                apiKey: verified.key,
              },
            } satisfies AuthSession;
          });

        const getSession = () =>
          apiKey ? getApiKeySession(apiKey) : getCookieSession();

        const requireSession = (): Effect.Effect<
          AuthSession,
          HttpApiError.Unauthorized
        > =>
          getSession().pipe(
            Effect.flatMap((authSession) =>
              authSession
                ? Effect.succeed(authSession)
                : Effect.fail(unauthorized()),
            ),
          );

        const requireUser = (): Effect.Effect<
          AuthSessionWithUser,
          HttpApiError.Unauthorized
        > =>
          requireSession().pipe(
            Effect.flatMap((authSession) =>
              authSession.user
                ? Effect.succeed({ ...authSession, user: authSession.user })
                : Effect.fail(unauthorized()),
            ),
          );

        const requireOrganization = (): Effect.Effect<
          AuthSessionWithOrganization,
          HttpApiError.Unauthorized
        > => requireSession().pipe(Effect.flatMap(withRequiredOrganization));

        const requireUserOrganization = (): Effect.Effect<
          AuthSessionWithUserAndOrganization,
          HttpApiError.Unauthorized
        > => requireUser().pipe(Effect.flatMap(withRequiredOrganization));

        return {
          ...api,
          getSession,
          requireSession,
          requireUser,
          requireOrganization,
          requireUserOrganization,
        };
      }),
  },
) {
  static readonly layer = (options: AuthServiceLayerOptions = {}) => {
    const headers = options.headers ?? {};

    return Layer.effect(this, this.make({ ...options, headers })).pipe(
      Layer.provide(
        AuthClientConfig.layer({
          ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
          ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        }),
      ),
      Layer.provide(authHttpClientLayer(headers)),
    );
  };
}
