import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  ImageUploadMultipartPayload,
  UploadedAsset,
} from "@/services/s3/schema";

export const OrganizationsApiGroup = HttpApiGroup.make("organizations")
  .add(
    HttpApiEndpoint.post(
      "uploadOrganizationLogo",
      "/organizations/logo/upload",
      {
        payload: ImageUploadMultipartPayload,
        success: UploadedAsset,
        error: [
          HttpApiError.BadRequest,
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Upload organization logo",
        summary: "Upload an organization logo",
        description:
          "Accepts a multipart image upload and returns the stable asset URL to store in organization metadata. Requires an authenticated user session.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Extra",
      description:
        "KrakStack-specific endpoints layered on top of Better Auth.",
    }),
  );
