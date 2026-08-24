import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { FrontendApi } from "@/api";

const siteUrl =
  globalThis.window?.location.origin ??
  import.meta.env.VITE_SITE_URL ??
  "http://localhost:3000";

export class ApiClient extends AtomHttpApi.Service<ApiClient>()("ApiClient", {
  api: FrontendApi,
  baseUrl: siteUrl,
  httpClient: FetchHttpClient.layer,
}) {}
