import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { AuthMember, AuthOrganization, AuthUser } from "@/lib/auth-schema";
import { ServiceApiKeyMiddleware } from "@/services/auth/middleware";
import {
  ServerCreateDomainPayload,
  ServerDomain,
  ServerDomainHostParams,
  ServerDomainIdParams,
  ServerDomainRecordsResponse,
} from "@krak-stack/auth/server";

import {
  BackendAuthActiveOrganization,
  BackendAuthIdParams,
  BackendAuthIdsQuery,
  BackendAuthMemberParams,
  BackendAuthMembersResponse,
  BackendAuthOrganizationChildrenResponse,
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
      title: "Users (Server)",
      description: "Server-to-server user endpoints for trusted services.",
    }),
  )
  .middleware(ServiceApiKeyMiddleware);

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
      "getOrganizationChildren",
      "/organizations/:organizationId/children",
      {
        params: BackendAuthOrganizationIdParams,
        success: BackendAuthOrganizationChildrenResponse,
        error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Get organization children",
        summary: "Get direct child organizations",
        description:
          "Returns direct child organizations for a parent organization. Requires a service API key.",
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
      title: "Organizations (Server)",
      description:
        "Server-to-server organization and membership endpoints for trusted services.",
    }),
  )
  .middleware(ServiceApiKeyMiddleware);

export const BackendAuthDomainsApiGroup = HttpApiGroup.make("backendDomains")
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
        title: "Create domain",
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
  )
  .middleware(ServiceApiKeyMiddleware);

export const BackendAuthApi = HttpApi.make("BackendAuthApi")
  .annotateMerge(
    OpenApi.annotations({
      title: "KrakStack Server API",
      version: "1.0.0",
      description:
        "Server-to-server KrakStack Auth API for trusted services that need identity records by ID.",
    }),
  )
  .add(BackendAuthUsersApiGroup)
  .add(BackendAuthOrganizationsApiGroup)
  .add(BackendAuthDomainsApiGroup)
  .prefix("/api");
