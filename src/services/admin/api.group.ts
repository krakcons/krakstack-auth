import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
import { Schema } from "effect";

import { OAuthStatsResponse } from "./schema";
import {
  CreateOrganizationPayload,
  Organization,
  OrganizationIdParams,
  UpdateOrganizationPayload,
} from "@/services/organizations/schema";

export const AdminApiGroup = HttpApiGroup.make("admin")
  .add(
    HttpApiEndpoint.get("oauthStats", "/admin/oauth-stats", {
      success: OAuthStatsResponse,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "OAuth stats",
        summary: "Get OAuth usage statistics",
        description:
          "Returns OAuth client and consent counts for authenticated administrators.",
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
  .annotateMerge(
    OpenApi.annotations({
      title: "Admin",
      description: "Administrative KrakStack authentication endpoints.",
    }),
  );
