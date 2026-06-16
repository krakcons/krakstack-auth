import { Context, Effect, Layer, Redacted } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { BetterAuthApi } from "./better-auth/api";
import { readClientConfig } from "./config";
import { ExtraApi } from "./extra/api";
import { ServerApi } from "./server/api";

const forwardedAuthHeaderNames = [
  "accept-language",
  "baggage",
  "cookie",
  "traceparent",
  "tracestate",
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

export class AuthClientConfig extends Context.Service<AuthClientConfig>()(
  "@krak-stack/auth/AuthClientConfig",
  { make: readClientConfig },
) {
  static readonly layer = Layer.effect(this, this.make);
}

export class AuthClient extends Context.Service<AuthClient>()(
  "@krak-stack/auth/AuthClient",
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
        },
        extra,
      };
    }),
  },
) {
  static readonly layer = (headers: Record<string, string> = {}) =>
    Layer.effect(this, this.make).pipe(
      Layer.provide(AuthClientConfig.layer),
      Layer.provide(authHttpClientLayer(headers)),
    );
}
