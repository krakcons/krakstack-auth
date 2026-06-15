import { Context, Effect, Layer, Redacted } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { readClientConfig } from "../config";
import { BackendApi } from "./api";

export class AuthClientConfig extends Context.Service<AuthClientConfig>()(
  "AuthClientConfig",
  { make: readClientConfig },
) {
  static readonly layer = Layer.effect(this, this.make);
}

export class AuthClient extends Context.Service<AuthClient>()(
  "AuthClient",
  {
    make: Effect.gen(function* () {
      const config = yield* AuthClientConfig;
      const http = yield* HttpClient.HttpClient;

      return yield* HttpApiClient.group(BackendApi, {
        group: "backend",
        baseUrl: config.baseUrl,
        httpClient: HttpClient.mapRequest(http, (request) =>
          HttpClientRequest.bearerToken(request, Redacted.value(config.apiKey)),
        ),
      });
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(AuthClientConfig.layer),
    Layer.provide(FetchHttpClient.layer),
  );
}

export { BackendApi, BackendApiGroup } from "./api";
export type { BackendOrganizationsResponse, BackendUsersResponse } from "./schema";
export type { Organization, User } from "../schema";
