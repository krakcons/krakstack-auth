import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { ActiveOrganization, Organization, UserIdParams } from "./schema";
import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

export const OrganizationsApiGroup = HttpApiGroup.make("organizations")
  .add(
    HttpApiEndpoint.get(
      "listUserOrganizations",
      "/organizations/user/:userId",
      {
        params: UserIdParams,
        success: Schema.Array(Organization),
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
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
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
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
      description:
        "Frontend organization endpoints. User session auth is accepted, and service API key auth is accepted for trusted services.",
    }),
  );
