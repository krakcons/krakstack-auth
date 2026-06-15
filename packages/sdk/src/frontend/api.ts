import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  FrontendPresignedUpload,
  FrontendPresignUploadPayload,
} from "./schema";

export const FrontendOrganizationsApiGroup = HttpApiGroup.make("organizations")
  .add(
    HttpApiEndpoint.post(
      "presignOrganizationLogoUpload",
      "/organizations/logo/presign",
      {
        payload: FrontendPresignUploadPayload,
        success: FrontendPresignedUpload,
        error: [
          HttpApiError.BadRequest,
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Frontend organizations",
      description:
        "Frontend API organization endpoints for browser-facing organization actions.",
    }),
  );

export const FrontendApi = HttpApi.make("FrontendApi")
  .add(FrontendOrganizationsApiGroup)
  .prefix("/api");
