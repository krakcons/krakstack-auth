import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { defaultBaseUrl } from "../config";
import { FrontendApi } from "./api";

export class FrontendApiClient extends AtomHttpApi.Service<FrontendApiClient>()(
  "FrontendApiClient",
  {
    api: FrontendApi,
    baseUrl: defaultBaseUrl(),
    httpClient: FetchHttpClient.layer,
  },
) {}

export { AuthClient, AuthClientConfig } from "../client";
export { FrontendApi, FrontendOrganizationsApiGroup } from "./api";
export type {
  FrontendPresignedUpload,
  FrontendPresignUploadPayload,
} from "./schema";
export type { Organization, OrganizationMetadata } from "../schema";
