import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { AdminApi } from "@/api";

const siteUrl =
  globalThis.window?.location.origin ??
  import.meta.env.VITE_SITE_URL ??
  "http://localhost:3000";

export class AdminApiClient extends AtomHttpApi.Service<AdminApiClient>()(
  "AdminApiClient",
  {
    api: AdminApi,
    baseUrl: siteUrl,
    httpClient: FetchHttpClient.layer,
  },
) {}
