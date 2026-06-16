import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  ExtraBadRequest,
  ExtraCreateApiKeyPayload,
  ExtraCreateApiKeyResponse,
  ExtraOkResponse,
  ExtraPresignedUpload,
  ExtraPresignUploadPayload,
  ExtraSetPasswordPayload,
  ExtraVerifyApiKeyPayload,
  ExtraVerifyApiKeyResponse,
  ExtraVerifyPasswordPayload,
} from "./schema";

export const ExtraApiGroup = HttpApiGroup.make("extra")
  .add(
    HttpApiEndpoint.post("setPassword", "/auth/set-password", {
      payload: ExtraSetPasswordPayload,
      success: ExtraOkResponse,
      error: ExtraBadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        title: "Set password",
        summary: "Set password for the current user",
        description:
          "Sets a password for the authenticated user using schema-validated input.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("verifyPassword", "/auth/verify-password", {
      payload: ExtraVerifyPasswordPayload,
      success: ExtraOkResponse,
      error: ExtraBadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        title: "Verify password",
        summary: "Verify current user password",
        description:
          "Verifies the authenticated user's password using schema-validated input.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("createApiKey", "/auth/create-api-key", {
      payload: ExtraCreateApiKeyPayload,
      success: ExtraCreateApiKeyResponse,
      error: ExtraBadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        title: "Create API key",
        summary: "Create an API key with optional permissions",
        description:
          "Creates a user or organization API key through Better Auth's server-side API so server-only fields like permissions can be set.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("verifyApiKey", "/auth/verify-api-key", {
      payload: ExtraVerifyApiKeyPayload,
      success: ExtraVerifyApiKeyResponse,
      error: ExtraBadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        title: "Verify API key",
        summary: "Verify a remote API key",
        description:
          "Verifies a user or organization API key and optional permissions using Better Auth's server-side API key verifier.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("presignUserImageUpload", "/auth/image/presign", {
      payload: ExtraPresignUploadPayload,
      success: ExtraPresignedUpload,
      error: [
        ExtraBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Presign user image upload",
        summary: "Create a presigned user image upload URL",
        description:
          "Returns a short-lived S3 upload URL and stable asset URL for the current user's profile image.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("presign", "/organizations/logo/presign", {
      payload: ExtraPresignUploadPayload,
      success: ExtraPresignedUpload,
      error: [
        HttpApiError.BadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Extra",
      description:
        "KrakStack-specific endpoints layered on top of Better Auth.",
    }),
  );

export const ExtraApi = HttpApi.make("ExtraApi")
  .add(ExtraApiGroup)
  .prefix("/api");
