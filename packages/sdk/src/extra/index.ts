import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { defaultBaseUrl } from "../config";
import { ExtraApi } from "./api";

export class ExtraApiClient extends AtomHttpApi.Service<ExtraApiClient>()(
  "ExtraApiClient",
  {
    api: ExtraApi,
    baseUrl: defaultBaseUrl(),
    httpClient: FetchHttpClient.layer,
  },
) {}

export { AuthClient, AuthClientConfig } from "../client";
export { ExtraApi, ExtraApiGroup } from "./api";
export * from "./schema";
export type { Organization, OrganizationMetadata } from "../schema";
