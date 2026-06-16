import { Context, Effect, Layer, Redacted } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { BackendApi } from "./backend/api";
import { BetterAuthApi } from "./better-auth/api";
import { readClientConfig } from "./config";
import { FrontendApi } from "./frontend/api";

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

      const backend = yield* HttpApiClient.group(BackendApi, {
        group: "backend",
        baseUrl: config.baseUrl,
        httpClient,
      });
      const frontend = yield* HttpApiClient.group(FrontendApi, {
        group: "organizations",
        baseUrl: config.baseUrl,
        httpClient,
      });
      const betterAuth = yield* HttpApiClient.group(BetterAuthApi, {
        group: "betterAuth",
        baseUrl: config.baseUrl,
        httpClient: http,
      });

      return {
        backend,
        betterAuth,
        frontend: {
          presignOrganizationLogoUpload: frontend.presignOrganizationLogoUpload,
        },
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(AuthClientConfig.layer),
    Layer.provide(FetchHttpClient.layer),
  );
}
