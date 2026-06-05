import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { Api } from "@/api";

const siteUrl = import.meta.env.VITE_SITE_URL ?? "http://localhost:3000";

export class ApiClient extends AtomHttpApi.Service<ApiClient>()("ApiClient", {
  api: Api,
  baseUrl: siteUrl,
  httpClient: FetchHttpClient.layer,
}) {}
