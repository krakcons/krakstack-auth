import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  BackendAuthIdsQuery,
  BackendAuthOrganizationsResponse,
  BackendAuthUsersResponse,
} from "./schema";

export const BackendAuthApiGroup = HttpApiGroup.make("backendAuth")
  .add(
    HttpApiEndpoint.get("listUsersByIds", "/users", {
      query: BackendAuthIdsQuery,
      success: BackendAuthUsersResponse,
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
      query: BackendAuthIdsQuery,
      success: BackendAuthOrganizationsResponse,
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
      title: "Backend auth",
      description:
        "Server-to-server authentication and identity hydration endpoints for trusted services.",
    }),
  );

export const BackendAuthApi = HttpApi.make("BackendAuthApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Backend Auth API",
      version: "1.0.0",
      description:
        "Server-to-server KrakStack Auth API for trusted services that need to hydrate identity records by ID.",
    }),
  )
  .add(BackendAuthApiGroup)
  .prefix("/api");
