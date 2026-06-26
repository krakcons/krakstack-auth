import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
import { Schema } from "effect";

import { DashboardStatsQuery, DashboardStatsResponse } from "./schema";
import { AdminAuthMiddleware } from "@/services/auth/middleware";
import {
  CreateOrganizationPayload,
  Organization,
  OrganizationIdParams,
  UpdateOrganizationPayload,
} from "@/services/organizations/schema";
import {
  ServerCreateDomainPayload,
  ServerDomain,
  ServerDomainIdParams,
  ServerDomainRecordsResponse,
  ServerUpdateDomainPayload,
} from "../../../packages/sdk/src/server/schema";

export const AdminApiGroup = HttpApiGroup.make("admin")
  .add(
    HttpApiEndpoint.get("dashboardStats", "/admin/dashboard-stats", {
      query: DashboardStatsQuery,
      success: DashboardStatsResponse,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Dashboard stats",
        summary: "Get dashboard statistics",
        description:
          "Returns user, organization, and daily active user counts for authenticated administrators.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("listOrganizations", "/admin/organizations", {
      success: Schema.Array(Organization),
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List organizations",
        summary: "List organizations for administrators",
        description: "Returns app-managed organization records.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("createOrganization", "/admin/organizations", {
      payload: CreateOrganizationPayload,
      success: Organization,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Create organization",
        summary: "Create an organization",
        description: "Creates an app-managed organization record.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.patch("updateOrganization", "/admin/organizations/:id", {
      params: OrganizationIdParams,
      payload: UpdateOrganizationPayload,
      success: Organization,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Update organization",
        summary: "Update an organization",
        description: "Updates an app-managed organization record.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.delete("deleteOrganization", "/admin/organizations/:id", {
      params: OrganizationIdParams,
      success: Organization,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Delete organization",
        summary: "Delete an organization",
        description: "Deletes an app-managed organization record.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("listDomains", "/admin/domains", {
      success: Schema.Array(ServerDomain),
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List domains",
        summary: "List auth domains",
        description: "Returns auth-owned custom hostnames for administrators.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("createDomain", "/admin/domains", {
      payload: ServerCreateDomainPayload,
      success: ServerDomain,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.BadRequest,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Create domain",
        summary: "Create an auth domain",
        description: "Registers an auth-owned custom hostname.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.patch("updateDomain", "/admin/domains/:id", {
      params: ServerDomainIdParams,
      payload: ServerUpdateDomainPayload,
      success: ServerDomain,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Update domain",
        summary: "Update an auth domain",
        description:
          "Updates trust target, ownership links, and Cloudflare management mode for an auth hostname.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("getDomainRecords", "/admin/domains/:id/records", {
      params: ServerDomainIdParams,
      success: ServerDomainRecordsResponse,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get domain records",
        summary: "Get auth domain DNS records",
        description:
          "Returns DNS records and refreshed status for an auth-owned custom hostname.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.delete("deleteDomain", "/admin/domains/:id", {
      params: ServerDomainIdParams,
      success: ServerDomain,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Delete domain",
        summary: "Delete an auth domain",
        description: "Deletes an auth-owned custom hostname.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Admin",
      description: "Administrative KrakStack authentication endpoints.",
    }),
  )
  .middleware(AdminAuthMiddleware);
