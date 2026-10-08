import { AuthClientApi } from "@krak-stack/auth/api";
import { authSessionAtom } from "@krak-stack/auth/components";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { AtomHttpApi, AtomRegistry } from "effect/reactivity";

import { apiRuntime } from "@/lib/api-runtime";

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
    runtime: apiRuntime,
  },
) {}

const makeAuthClient = HttpApiClient.make(AuthClientApi, {
  baseUrl: authOrigin,
  transformClient: withCredentials,
}).pipe(Effect.provide(FetchHttpClient.layer));

const sessionAtom = authSessionAtom(authOrigin);

export const getAuthSession = (registry: AtomRegistry.AtomRegistry) =>
  AtomRegistry.getResult(registry, sessionAtom);

export const ensureKrakOrganizationSelected = () =>
  makeAuthClient.pipe(
    Effect.flatMap((client) =>
      client.auth.organizationSetActive({
        payload: { organizationSlug: KRAK_ORGANIZATION_SLUG },
      }),
    ),
  );
