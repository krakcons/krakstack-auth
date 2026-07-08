import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { AdminApiGroup } from "./admin/api.group";
import { BetterAuthApiGroup } from "./better-auth/api.group";
import { ExtraApiGroup } from "./extra/api.group";
import {
  ServerDomainsApiGroup,
  ServerOrganizationsApiGroup,
  ServerUsersApiGroup,
} from "./server/api.group";

export const AuthServiceApi = HttpApi.make("AuthServiceApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth Service API",
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

export const AuthClientApi = HttpApi.make("AuthClientApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth Client API",
      version: "1.0.0",
      description:
        "Browser-facing API used by KrakStack Auth React components.",
    }),
  )
  .add(
    BetterAuthApiGroup.prefix("/auth"),
    ExtraApiGroup,
    AdminApiGroup.prefix("/auth"),
  )
  .prefix("/api");
