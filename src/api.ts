import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { AdminApiGroup } from "@/services/admin/api.group";
import { AuthApiGroup } from "@/services/auth/api.group";
import {
  AdminOAuthClientsApiGroup,
  PublicOAuthClientsApiGroup,
} from "@/services/oauth/api.group";
import { OrganizationsApiGroup } from "@/services/organizations/api.group";
import {
  AdminProjectsApiGroup,
  PublicProjectsApiGroup,
} from "@/services/projects/api.group";

export const AdminApi = HttpApi.make("AdminApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Admin API",
      version: "1.0.0",
      description: "Administrative API for KrakStack authentication services.",
    }),
  )
  .add(AdminApiGroup)
  .add(AdminOAuthClientsApiGroup)
  .add(AdminProjectsApiGroup)
  .prefix("/api");

export const FrontendApi = HttpApi.make("FrontendApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Auth API",
      version: "1.0.0",
      description:
        "Frontend API for KrakStack user authentication and browser-facing auth flows.",
    }),
  )
  .add(AuthApiGroup)
  .add(OrganizationsApiGroup)
  .add(PublicOAuthClientsApiGroup)
  .add(PublicProjectsApiGroup)
  .prefix("/api");
