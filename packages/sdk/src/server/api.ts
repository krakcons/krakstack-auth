import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import { Member, Organization, User } from "../schema";
import {
  ServerActiveOrganization,
  ServerCreateDomainPayload,
  ServerDomain,
  ServerDomainHostParams,
  ServerDomainIdParams,
  ServerDomainRecordsResponse,
  ServerIdParams,
  ServerIdsQuery,
  ServerMemberParams,
  ServerMembersResponse,
  ServerOrganizationIdParams,
  ServerOrganizationsQuery,
  ServerOrganizationsResponse,
  ServerUserIdParams,
  ServerUsersResponse,
} from "./schema";

export const ServerUsersApiGroup = HttpApiGroup.make("serverUsers")
  .add(
    HttpApiEndpoint.get("listUsersByIds", "/users", {
      query: ServerIdsQuery,
      success: ServerUsersResponse,
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
      params: ServerIdParams,
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
        params: ServerUserIdParams,
        success: ServerActiveOrganization,
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
      title: "Users (Server)",
      description: "Server-to-server user endpoints for trusted services.",
    }),
  );

export const ServerOrganizationsApiGroup = HttpApiGroup.make(
  "serverOrganizations",
)
  .add(
    HttpApiEndpoint.get("listOrganizations", "/organizations", {
      query: ServerOrganizationsQuery,
      success: ServerOrganizationsResponse,
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
      params: ServerIdParams,
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
        params: ServerMemberParams,
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
        params: ServerOrganizationIdParams,
        success: ServerMembersResponse,
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
      title: "Organizations (Server)",
      description:
        "Server-to-server organization and membership endpoints for trusted services.",
    }),
  );

export const ServerDomainsApiGroup = HttpApiGroup.make("serverDomains")
  .add(
    HttpApiEndpoint.post("createDomain", "/domains", {
      payload: ServerCreateDomainPayload,
      success: ServerDomain,
      error: [
        HttpApiError.BadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Create server domain",
        summary: "Create an auth-owned custom hostname",
        description:
          "Registers an auth custom hostname for a trusted service. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("getDomain", "/domains/:id", {
      params: ServerDomainIdParams,
      success: ServerDomain,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("getDomainByHost", "/domains/by-host/:hostname", {
      params: ServerDomainHostParams,
      success: ServerDomain,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("getDomainRecords", "/domains/:id/records", {
      params: ServerDomainIdParams,
      success: ServerDomainRecordsResponse,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.delete("deleteDomain", "/domains/:id", {
      params: ServerDomainIdParams,
      success: ServerDomain,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Domains (Server)",
      description: "Server-to-server auth custom hostname endpoints.",
    }),
  );

export const ServerApi = HttpApi.make("ServerApi")
  .add(ServerUsersApiGroup)
  .add(ServerOrganizationsApiGroup)
  .add(ServerDomainsApiGroup)
  .prefix("/api");
