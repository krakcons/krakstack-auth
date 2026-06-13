import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  ActiveOrganization,
  CreateOrganizationPayload,
  Organization,
  OrganizationIdParams,
  UpdateOrganizationPayload,
  UserIdParams,
} from "./schema";
import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

export const OrganizationsApiGroup = HttpApiGroup.make("organizations")
  .add(
    HttpApiEndpoint.get("listOrganizations", "/organizations", {
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
    HttpApiEndpoint.get(
      "listUserOrganizations",
      "/organizations/user/:userId",
      {
        params: UserIdParams,
        success: Schema.Array(Organization),
        error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "List user organizations",
        summary: "List organizations for a user",
        description:
          "Returns organization records for a user. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "getUserActiveOrganization",
      "/organizations/user/:userId/active",
      {
        params: UserIdParams,
        success: ActiveOrganization,
        error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Get user active organization",
        summary: "Get active organization for a user",
        description:
          "Returns the active organization ID from the user's latest central auth session. Requires a service API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("createOrganization", "/organizations", {
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
    HttpApiEndpoint.patch("updateOrganization", "/organizations/:id", {
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
    HttpApiEndpoint.delete("deleteOrganization", "/organizations/:id", {
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
    HttpApiEndpoint.post(
      "presignOrganizationLogoUpload",
      "/organizations/logo/presign",
      {
        payload: PresignUploadPayload,
        success: PresignedUpload,
        error: [
          HttpApiError.BadRequest,
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Presign organization logo upload",
        summary: "Create a presigned organization logo upload URL",
        description:
          "Returns a short-lived S3 upload URL and the stable asset URL to store in organization metadata. Requires an authenticated user session.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Organizations",
      description: "Organization administration endpoints.",
    }),
  );
