import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";
import { HttpApi, HttpApiClient } from "effect/unstable/httpapi";

import { AuthClientApi } from "../api.js";
import { defaultBaseUrl } from "../config.js";

const authClientApiUrl = (baseUrl?: string | undefined) => {
  const url =
    baseUrl?.trim() || globalThis.window?.location.origin || defaultBaseUrl();
  return url.replace(/\/$/, "");
};

const withCredentials = (client: HttpClient.HttpClient) =>
  HttpClient.makeWith(
    (request) =>
      client.postprocess(request).pipe(
        Effect.provideService(FetchHttpClient.RequestInit, {
          credentials: "include",
        }),
      ),
    client.preprocess,
  );

export const authHttpClient = (baseUrl?: string | undefined) =>
  HttpApiClient.make(AuthClientApi, {
    baseUrl: authClientApiUrl(baseUrl),
    transformClient: withCredentials,
  }).pipe(Effect.provide(FetchHttpClient.layer));

type AuthClientApiGroups =
  typeof AuthClientApi extends HttpApi.HttpApi<string, infer Groups>
    ? Groups
    : never;

type AuthClientApiClient = Pick<
  AtomHttpApi.AtomHttpApiClient<never, string, AuthClientApiGroups>,
  "mutation" | "query" | "runtime"
>;

const createAuthClientApiClient = (key: string): AuthClientApiClient => {
  class AuthClientApiClient extends AtomHttpApi.Service<AuthClientApiClient>()(
    `AuthClientApi:${key}`,
    {
      api: AuthClientApi,
      baseUrl: key,
      httpClient: FetchHttpClient.layer,
      transformClient: withCredentials,
    },
  ) {}

  return AuthClientApiClient;
};

const authClientApis = new Map<string, AuthClientApiClient>();

export const authClientApi: (
  baseUrl?: string | undefined,
) => AuthClientApiClient = (baseUrl) => {
  const key = authClientApiUrl(baseUrl);
  const existing = authClientApis.get(key);

  if (existing) return existing;

  const client = createAuthClientApiClient(key);
  authClientApis.set(key, client);

  return client;
};
