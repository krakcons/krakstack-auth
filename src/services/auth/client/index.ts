import { AuthClientApi } from "@krak-stack/auth/api";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { AtomHttpApi } from "effect/unstable/reactivity";

export const KRAK_ORGANIZATION_SLUG = "krak";

export const authBaseUrl =
  import.meta.env.VITE_KRAKSTACK_AUTH_URL ?? import.meta.env.VITE_SITE_URL;

const authOrigin =
  authBaseUrl ??
  globalThis.window?.location.origin ??
  import.meta.env.VITE_SITE_URL ??
  "http://localhost:3000";

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

export class AuthApiClient extends AtomHttpApi.Service<AuthApiClient>()(
  "AuthApiClient",
  {
    api: AuthClientApi,
    baseUrl: authOrigin,
    httpClient: FetchHttpClient.layer,
    transformClient: withCredentials,
  },
) {}

const makeAuthClient = HttpApiClient.make(AuthClientApi, {
  baseUrl: authOrigin,
  transformClient: withCredentials,
}).pipe(Effect.provide(FetchHttpClient.layer));

export const getAuthSession = () =>
  makeAuthClient.pipe(
    Effect.flatMap((client) =>
      client.auth.getSession({
        query: { disableCookieCache: "true" },
      }),
    ),
  );

export const ensureKrakOrganizationSelected = () =>
  makeAuthClient.pipe(
    Effect.flatMap((client) =>
      client.auth.organizationSetActive({
        payload: { organizationSlug: KRAK_ORGANIZATION_SLUG },
      }),
    ),
  );
