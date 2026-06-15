import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  FrontendActiveOrganization,
  FrontendOrganizationsResponse,
  FrontendPresignedUpload,
  FrontendPresignUploadPayload,
  FrontendUserIdParams,
} from "./schema";

export const FrontendOrganizationsApiGroup = HttpApiGroup.make(
  "organizations",
)
  .add(
    HttpApiEndpoint.get(
      "listUserOrganizations",
      "/organizations/user/:userId",
      {
        params: FrontendUserIdParams,
        success: FrontendOrganizationsResponse,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "getUserActiveOrganization",
      "/organizations/user/:userId/active",
      {
        params: FrontendUserIdParams,
        success: FrontendActiveOrganization,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
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
        "Frontend API organization endpoints that can be called with a service API key.",
    }),
  );

export const FrontendApi = HttpApi.make("FrontendApi")
  .add(FrontendOrganizationsApiGroup)
  .prefix("/api");
