import {
  Cache,
  Duration,
  Context,
  Effect,
  Layer,
  Redacted,
  Exit,
} from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { BetterAuthApi } from "./better-auth/api";
import { AuthClientConfig, type ClientConfig } from "./config";
import { ExtraApi } from "./extra/api";
import { ServerApi } from "./server/api";
import type { GetSessionResponse } from "./better-auth";

export type AuthClientLayerOptions = Partial<ClientConfig> & {
  readonly headers?: Record<string, string>;
};

const forwardedAuthHeaderNames = [
  "accept-language",
  "cookie",
  "user-agent",
] as const;

const forwardedAuthHeaders = (headers: Record<string, string>) => {
  const forwarded: Record<string, string> = {};

  for (const name of forwardedAuthHeaderNames) {
    const value = headers[name];
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

const clientConfigOptions = ({ baseUrl, apiKey }: AuthClientLayerOptions) => ({
  ...(baseUrl ? { baseUrl } : {}),
  ...(apiKey ? { apiKey } : {}),
});

export class AuthApiClients extends Context.Service<AuthApiClients>()(
  "@krak-stack/auth/AuthApiClients",
  {
    make: Effect.gen(function* () {
      const config = yield* AuthClientConfig;
      const http = yield* HttpClient.HttpClient;
      const httpClient = HttpClient.mapRequest(http, (request) =>
        HttpClientRequest.bearerToken(request, Redacted.value(config.apiKey)),
      );

      const serverUsers = yield* HttpApiClient.group(ServerApi, {
        group: "serverUsers",
        baseUrl: config.baseUrl,
        httpClient,
      });
      const serverOrganizations = yield* HttpApiClient.group(ServerApi, {
        group: "serverOrganizations",
        baseUrl: config.baseUrl,
        httpClient,
      });
      const serverDomains = yield* HttpApiClient.group(ServerApi, {
        group: "serverDomains",
        baseUrl: config.baseUrl,
        httpClient,
      });
      const extra = yield* HttpApiClient.group(ExtraApi, {
        group: "extra",
        baseUrl: config.baseUrl,
        httpClient,
      });
      const betterAuth = yield* HttpApiClient.group(BetterAuthApi, {
        group: "betterAuth",
        baseUrl: config.baseUrl,
        httpClient: http,
      });

      return {
        ...betterAuth,
        server: {
          ...serverUsers,
          ...serverOrganizations,
          domains: {
            create: serverDomains.createDomain,
            get: serverDomains.getDomain,
            getByHost: serverDomains.getDomainByHost,
            records: serverDomains.getDomainRecords,
            delete: serverDomains.deleteDomain,
          },
        },
        extra,
      };
    }),
  },
) {
  static readonly layer = (options: AuthClientLayerOptions = {}) => {
    const headers = options.headers ?? {};

    return Layer.effect(this, this.make).pipe(
      Layer.provide(AuthClientConfig.layer(clientConfigOptions(options))),
      Layer.provide(authHttpClientLayer(headers)),
    );
  };
}

const sessionCache = Effect.runSync(
  Cache.makeWith<string, GetSessionResponse, unknown, AuthApiClients, "lookup">(
    () =>
      Effect.gen(function* () {
        const auth = yield* AuthApiClients;

        return yield* auth.getSession();
      }),
    {
      capacity: 500,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) ? Duration.seconds(2) : Duration.zero,
      requireServicesAt: "lookup",
    },
  ),
);

export class AuthClient extends Context.Service<AuthClient>()(
  "@krak-stack/auth/AuthClient",
  {
    make: (headers: Record<string, string> = {}) =>
      Effect.gen(function* () {
        const clients = yield* AuthApiClients;
        const sessionCacheKey = getSessionCacheKey(headers);

        return {
          ...clients,
          getSession: () =>
            Cache.get(sessionCache, sessionCacheKey).pipe(
              Effect.provideService(AuthApiClients, clients),
            ),
        };
      }),
  },
) {
  static readonly layer = (options: AuthClientLayerOptions = {}) => {
    const headers = options.headers ?? {};

    return Layer.effect(this, this.make(headers)).pipe(
      Layer.provide(AuthClientConfig.layer(clientConfigOptions(options))),
      Layer.provide(AuthApiClients.layer(options)),
    );
  };
}
