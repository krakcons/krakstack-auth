import { Context, Effect, Layer, Redacted } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { defaultBaseUrl, readClientConfig } from "../config";
import { FrontendApi } from "./api";

export class FrontendApiClient extends AtomHttpApi.Service<FrontendApiClient>()(
  "FrontendApiClient",
  {
    api: FrontendApi,
    baseUrl: defaultBaseUrl(),
    httpClient: FetchHttpClient.layer,
  },
) {}

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

      return yield* HttpApiClient.group(FrontendApi, {
        group: "organizations",
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

export { FrontendApi, FrontendOrganizationsApiGroup } from "./api";
export type {
  FrontendActiveOrganization,
  FrontendOrganizationsResponse,
  FrontendPresignedUpload,
  FrontendPresignUploadPayload,
} from "./schema";
export type { Organization } from "../schema";
