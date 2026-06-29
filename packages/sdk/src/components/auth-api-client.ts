import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { AuthApi } from "../api";

const authApiUrl = (baseUrl?: string | undefined) => {
  const url =
    baseUrl?.trim() ||
    (typeof window === "undefined"
      ? "http://localhost:3000"
      : window.location.origin);
  return url.replace(/\/$/, "");
};

const createAuthApiClient = (key: string) =>
  AtomHttpApi.Service<object>()(`AuthApi:${key}`, {
    api: AuthApi,
    baseUrl: key,
    httpClient: FetchHttpClient.layer,
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

const authApiClients = new Map<string, ReturnType<typeof createAuthApiClient>>();

export const authApiClient = (baseUrl?: string | undefined) => {
  const key = authApiUrl(baseUrl);
  const existing = authApiClients.get(key);

  if (existing) return existing;

  const client = createAuthApiClient(key);
  authApiClients.set(key, client);

  return client;
};
