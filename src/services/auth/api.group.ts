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

import {
  AuthBadRequest,
  AuthProjectPublicConfig,
  AuthProjectPublicConfigQuery,
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
    HttpApiEndpoint.get("getProjectPublicConfig", "/auth/project-config", {
      query: AuthProjectPublicConfigQuery,
      success: AuthProjectPublicConfig,
      error: [HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get project public config",
        summary: "Get host-aware project white-label config",
        description:
          "Returns resolved public branding and authentication options through the auth API.",
      }),
    ),
  )
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
    HttpApiEndpoint.post("uploadUserImage", "/auth/image/upload", {
      payload: ImageUploadMultipartPayload,
      success: UploadedAsset,
      error: [
        AuthBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Upload user image",
        summary: "Upload a user profile image",
        description:
          "Accepts a multipart image upload and stores it as the current user's profile image asset.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Auth",
      description: "Custom KrakStack authentication endpoints.",
    }),
  );
