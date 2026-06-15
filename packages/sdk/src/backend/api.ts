import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  BackendIdsQuery,
  BackendOrganizationsResponse,
  BackendUsersResponse,
} from "./schema";

export const BackendApiGroup = HttpApiGroup.make("backend")
  .add(
    HttpApiEndpoint.get("listUsersByIds", "/users", {
      query: BackendIdsQuery,
      success: BackendUsersResponse,
      error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List users by IDs",
        summary: "Hydrate user records for backend services",
        description:
          "Returns trusted user records for a comma-separated list of IDs. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("listOrganizationsByIds", "/organizations", {
      query: BackendIdsQuery,
      success: BackendOrganizationsResponse,
      error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List organizations by IDs",
        summary: "Hydrate organization records for backend services",
        description:
          "Returns trusted organization records for a comma-separated list of IDs. Requires a service API key.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Backend",
      description:
        "Server-to-server authentication and identity hydration endpoints for trusted services.",
    }),
  );

export const BackendApi = HttpApi.make("BackendApi")
  .add(BackendApiGroup)
  .prefix("/api");
