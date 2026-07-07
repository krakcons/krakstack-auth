import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { AuthClientApi } from "../api";
import { defaultBaseUrl } from "../config";

const fetchHttpClientLayer = FetchHttpClient.layer as Layer.Layer<unknown>;

const authClientApiUrl = (baseUrl?: string | undefined) => {
  const url =
    baseUrl?.trim() ||
    (typeof window === "undefined" ? defaultBaseUrl() : window.location.origin);
  return url.replace(/\/$/, "");
};

const createAuthClientApiClient = (key: string) =>
  AtomHttpApi.Service<object>()(`AuthClientApi:${key}`, {
    api: AuthClientApi,
    baseUrl: key,
    httpClient: fetchHttpClientLayer,
    transformClient: (client) =>
      HttpClient.makeWith(
        (request) =>
          client.postprocess(request).pipe(
            Effect.provideService(FetchHttpClient.RequestInit, {
              credentials: "include",
            }),
          ),
        client.preprocess,
      ),
  });

const authClientApis = new Map<
  string,
  ReturnType<typeof createAuthClientApiClient>
>();

export const authClientApi = (baseUrl?: string | undefined) => {
  const key = authClientApiUrl(baseUrl);
  const existing = authClientApis.get(key);

  if (existing) return existing;

  const client = createAuthClientApiClient(key);
  authClientApis.set(key, client);

  return client;
};
