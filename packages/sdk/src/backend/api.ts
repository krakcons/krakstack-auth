import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import { Organization, User } from "../schema";
import {
  BackendIdParams,
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
        summary: "List users by IDs",
        description:
          "Returns trusted user records for a comma-separated list of IDs. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("getUser", "/users/:id", {
      params: BackendIdParams,
      success: User,
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
  .add(
    HttpApiEndpoint.get("listOrganizationsByIds", "/organizations", {
      query: BackendIdsQuery,
      success: BackendOrganizationsResponse,
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
      params: BackendIdParams,
      success: Organization,
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
      title: "Backend",
      description:
        "Server-to-server authentication and identity endpoints for trusted services.",
    }),
  );

export const BackendApi = HttpApi.make("BackendApi")
  .add(BackendApiGroup)
  .prefix("/api");
