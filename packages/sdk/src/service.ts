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

import { AuthApi } from "./api";
import { AuthClientConfig, type ClientConfig } from "./config";
import type { GetSessionResponse } from "./better-auth";

export type AuthServiceLayerOptions = Partial<ClientConfig> & {
  readonly headers?: Record<string, string>;
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

const clientConfigOptions = ({ baseUrl, apiKey }: AuthServiceLayerOptions) => ({
  ...(baseUrl ? { baseUrl } : {}),
  ...(apiKey ? { apiKey } : {}),
});

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
    make: (headers: Record<string, string> = {}) =>
      Effect.gen(function* () {
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

        const api = yield* HttpApiClient.makeWith(AuthApi, {
          baseUrl: config.baseUrl,
          httpClient,
        });
        const sessionCacheKey = getSessionCacheKey(headers);

        return {
          ...api,
          auth: {
            ...api.auth,
            getSession: () =>
              Cache.get(sessionCache, sessionCacheKey).pipe(
                Effect.provideService(SessionLookup, {
                  getSession: api.auth.getSession,
                }),
              ),
          },
        };
      }),
  },
) {
  static readonly layer = (options: AuthServiceLayerOptions = {}) => {
    const headers = options.headers ?? {};

    return Layer.effect(this, this.make(headers)).pipe(
      Layer.provide(AuthClientConfig.layer(clientConfigOptions(options))),
      Layer.provide(authHttpClientLayer(headers)),
    );
  };
}
