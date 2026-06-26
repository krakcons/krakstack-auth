import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { BetterAuthApi } from "../packages/sdk/src/better-auth/api";
import { ExtraApi } from "../packages/sdk/src/extra/api";
import { ServerApi } from "../packages/sdk/src/server/api";

export const AuthDocsApi = HttpApi.make("AuthDocsApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth API",
      version: "1.0.0",
      description:
        "Auth API documentation for Better Auth extensions, KrakStack extra endpoints, and trusted server endpoints.",
    }),
  )
  .addHttpApi(BetterAuthApi)
  .addHttpApi(ExtraApi)
  .addHttpApi(ServerApi);
