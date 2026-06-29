import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { BetterAuthApiGroup } from "./better-auth/api";
import { ExtraApiGroup } from "./extra/api";
import {
  ServerDomainsApiGroup,
  ServerOrganizationsApiGroup,
  ServerUsersApiGroup,
} from "./server/api";

export const AuthApi = HttpApi.make("AuthApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth API",
      version: "1.0.0",
      description:
        "Auth API for Better Auth extensions, KrakStack extra endpoints, and trusted server endpoints.",
    }),
  )
  .add(
    BetterAuthApiGroup.prefix("/auth"),
    ExtraApiGroup,
    ServerUsersApiGroup,
    ServerOrganizationsApiGroup,
    ServerDomainsApiGroup,
  )
  .prefix("/api");
