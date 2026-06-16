import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { defaultBaseUrl } from "../config";
import { BetterAuthApi } from "./api";

export class BetterAuthApiClient extends AtomHttpApi.Service<BetterAuthApiClient>()(
  "BetterAuthApiClient",
  {
    api: BetterAuthApi,
    baseUrl: defaultBaseUrl(),
    httpClient: FetchHttpClient.layer,
  },
) {}

export { BetterAuthApi, BetterAuthApiGroup } from "./api";
export * from "./schema";
export type { Session, User } from "../schema";
