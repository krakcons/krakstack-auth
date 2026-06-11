import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

import {
  AuthBadRequest,
  AuthOkResponse,
  CreateApiKeyPayload,
  CreateApiKeyResponse,
  SetPasswordPayload,
  VerifyApiKeyPayload,
  VerifyApiKeyResponse,
  VerifyPasswordPayload,
} from "./schema";

export const AuthApiGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("setPassword", "/auth/set-password", {
      payload: SetPasswordPayload,
      success: AuthOkResponse,
      error: AuthBadRequest,
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
      payload: VerifyPasswordPayload,
      success: AuthOkResponse,
      error: AuthBadRequest,
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
      payload: CreateApiKeyPayload,
      success: CreateApiKeyResponse,
      error: AuthBadRequest,
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
      payload: VerifyApiKeyPayload,
      success: VerifyApiKeyResponse,
      error: AuthBadRequest,
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
      payload: PresignUploadPayload,
      success: PresignedUpload,
      error: [
        AuthBadRequest,
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
  .annotateMerge(
    OpenApi.annotations({
      title: "Auth",
      description: "Custom KrakStack authentication endpoints.",
    }),
  );
