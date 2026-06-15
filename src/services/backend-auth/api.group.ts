import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { AuthOrganization, AuthUser } from "@/lib/auth-schema";

import {
  BackendAuthIdParams,
  BackendAuthIdsQuery,
  BackendAuthOrganizationsResponse,
  BackendAuthUsersResponse,
} from "./schema";

export const BackendAuthUsersApiGroup = HttpApiGroup.make("backendUsers")
  .add(
    HttpApiEndpoint.get("listUsersByIds", "/users", {
      query: BackendAuthIdsQuery,
      success: BackendAuthUsersResponse,
      error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List users by IDs",
        summary: "List users by IDs",
        description:
          "Returns trusted user records for a comma-separated list of IDs. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("getUser", "/users/:id", {
      params: BackendAuthIdParams,
      success: AuthUser,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get user",
        summary: "Get a user by ID",
        description:
          "Returns a trusted user record by ID. Requires a service API key.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Users",
      description: "Server-to-server user endpoints for trusted services.",
    }),
  );

export const BackendAuthOrganizationsApiGroup = HttpApiGroup.make(
  "backendOrganizations",
)
  .add(
    HttpApiEndpoint.get("listOrganizationsByIds", "/organizations", {
      query: BackendAuthIdsQuery,
      success: BackendAuthOrganizationsResponse,
      error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List organizations by IDs",
        summary: "List organizations by IDs",
        description:
          "Returns trusted organization records for a comma-separated list of IDs. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("getOrganization", "/organizations/:id", {
      params: BackendAuthIdParams,
      success: AuthOrganization,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get organization",
        summary: "Get an organization by ID",
        description:
          "Returns a trusted organization record by ID. Requires a service API key.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Organizations",
      description: "Server-to-server organization endpoints for trusted services.",
    }),
  );

export const BackendAuthApi = HttpApi.make("BackendAuthApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Backend Auth API",
      version: "1.0.0",
      description:
        "Server-to-server KrakStack Auth API for trusted services that need identity records by ID.",
    }),
  )
  .add(BackendAuthUsersApiGroup)
  .add(BackendAuthOrganizationsApiGroup)
  .prefix("/api");
