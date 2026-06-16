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
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(AuthClientConfig.layer),
    Layer.provide(FetchHttpClient.layer),
  );
}
