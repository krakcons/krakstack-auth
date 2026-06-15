import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { AuthMember, AuthOrganization, AuthUser } from "@/lib/auth-schema";

import {
  BackendAuthActiveOrganization,
  BackendAuthIdParams,
  BackendAuthIdsQuery,
  BackendAuthMemberParams,
  BackendAuthMembersResponse,
  BackendAuthOrganizationIdParams,
  BackendAuthOrganizationsQuery,
  BackendAuthOrganizationsResponse,
  BackendAuthUserIdParams,
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
  .add(
    HttpApiEndpoint.get(
      "getUserActiveOrganization",
      "/organizations/user/:userId/active",
      {
        params: BackendAuthUserIdParams,
        success: BackendAuthActiveOrganization,
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
    HttpApiEndpoint.get("listOrganizations", "/organizations", {
      query: BackendAuthOrganizationsQuery,
      success: BackendAuthOrganizationsResponse,
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
  .add(
    HttpApiEndpoint.get(
      "getActiveMember",
      "/organizations/:organizationId/members/:userId",
      {
        params: BackendAuthMemberParams,
        success: AuthMember,
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
        params: BackendAuthOrganizationIdParams,
        success: BackendAuthMembersResponse,
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
      title: "Organizations",
      description:
        "Server-to-server organization and membership endpoints for trusted services.",
    }),
  );

export const BackendAuthApi = HttpApi.make("BackendAuthApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Backend API",
      version: "1.0.0",
      description:
        "Server-to-server KrakStack Auth API for trusted services that need identity records by ID.",
    }),
  )
  .add(BackendAuthUsersApiGroup)
  .add(BackendAuthOrganizationsApiGroup)
  .prefix("/api");
