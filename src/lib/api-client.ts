import { FetchHttpClient } from "effect/http";
import { AtomHttpApi } from "effect/reactivity";

import { FrontendApi } from "@/api";
import { apiRuntime } from "@/lib/api-runtime";

const siteUrl =
  globalThis.window?.location.origin ??
  import.meta.env.VITE_SITE_URL ??
  "http://localhost:3000";

export class ApiClient extends AtomHttpApi.Service<ApiClient>()("ApiClient", {
  api: FrontendApi,
  baseUrl: siteUrl,
  httpClient: FetchHttpClient.layer,
  runtime: apiRuntime,
}) {}
