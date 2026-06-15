import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import { Member, Organization, User } from "../schema";
import {
  BackendActiveOrganization,
  BackendIdParams,
  BackendIdsQuery,
  BackendMemberParams,
  BackendMembersResponse,
  BackendOrganizationIdParams,
  BackendOrganizationsQuery,
  BackendOrganizationsResponse,
  BackendUserIdParams,
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
    HttpApiEndpoint.get(
      "getUserActiveOrganization",
      "/organizations/user/:userId/active",
      {
        params: BackendUserIdParams,
        success: BackendActiveOrganization,
        error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Get user active organization",
        summary: "Get active organization for a user",
        description:
          "Returns the active organization ID from the user's latest auth session. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("listOrganizations", "/organizations", {
      query: BackendOrganizationsQuery,
      success: BackendOrganizationsResponse,
      error: [
        HttpApiError.BadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List organizations",
        summary: "List organizations by IDs or user ID",
        description:
          "Returns trusted organization records for either a comma-separated list of IDs or a user ID. Exactly one of ids or userId is required. Requires a service API key.",
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
  .add(
    HttpApiEndpoint.get(
      "getActiveMember",
      "/organizations/:organizationId/members/:userId",
      {
        params: BackendMemberParams,
        success: Member,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Get active member",
        summary: "Get a user's current organization membership",
        description:
          "Returns the member record and role for a user in an organization. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "listOrganizationMembers",
      "/organizations/:organizationId/members",
      {
        params: BackendOrganizationIdParams,
        success: BackendMembersResponse,
        error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "List organization members",
        summary: "List organization members",
        description:
          "Returns organization members with user contact details. Requires a service API key.",
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
