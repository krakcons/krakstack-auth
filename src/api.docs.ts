import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { AuthApi } from "../packages/sdk/src/api";

export const AuthDocsApi = HttpApi.make("AuthDocsApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth API",
      version: "1.0.0",
      description:
        "Auth API documentation for Better Auth extensions, KrakStack extra endpoints, and trusted server endpoints.",
    }),
  )
  .addHttpApi(AuthApi);
