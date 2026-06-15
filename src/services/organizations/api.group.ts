import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

export const OrganizationsApiGroup = HttpApiGroup.make("organizations")
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
