import { FetchHttpClient } from "effect/unstable/http";
import { Layer } from "effect";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { AdminApi } from "@/api";

const siteUrl =
  typeof window === "undefined"
    ? (import.meta.env.VITE_SITE_URL ?? "http://localhost:3000")
    : window.location.origin;

// AtomHttpApi expects Layer<unknown> when admin client services collapse to unknown.
const fetchHttpClientLayer = FetchHttpClient.layer as Layer.Layer<unknown>;

export class AdminApiClient extends AtomHttpApi.Service<AdminApiClient>()(
  "AdminApiClient",
  {
    api: AdminApi,
    baseUrl: siteUrl,
    httpClient: fetchHttpClientLayer,
  },
) {}
