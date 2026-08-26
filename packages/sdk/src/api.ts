import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { AdminApiGroup } from "./admin/api.group.js";
import { AuthApiGroup } from "./auth/api.group.js";
import { ExtraApiGroup } from "./extra/api.group.js";
import {
  ServerDomainsApiGroup,
  ServerOrganizationsApiGroup,
  ServerUsersApiGroup,
} from "./server/api.group.js";

export const AuthServiceApi = HttpApi.make("AuthServiceApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth Service API",
      version: "1.0.0",
      description:
        "Authentication API for browser, extension, and trusted server endpoints.",
    }),
  )
  .add(
    AuthApiGroup.prefix("/auth"),
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
    AuthApiGroup.prefix("/auth"),
    ExtraApiGroup,
    AdminApiGroup.prefix("/auth"),
  )
  .prefix("/api");
