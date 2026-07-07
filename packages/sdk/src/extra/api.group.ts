import { OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  ExtraBadRequest,
  ExtraCreateApiKeyPayload,
  ExtraCreateApiKeyResponse,
  ExtraImageUploadMultipartPayload,
  ExtraOkResponse,
  ExtraProjectPublicConfig,
  ExtraProjectPublicConfigQuery,
  ExtraSetPasswordPayload,
  ExtraUploadedAsset,
  ExtraVerifyApiKeyPayload,
  ExtraVerifyApiKeyResponse,
  ExtraVerifyPasswordPayload,
} from "./schema";

export * from "./schema";
export type { Organization, OrganizationMetadata } from "../schema";

export const ExtraApiGroup = HttpApiGroup.make("authExtra")
  .add(
    HttpApiEndpoint.get("getProjectPublicConfig", "/auth/project-config", {
      query: ExtraProjectPublicConfigQuery,
      success: ExtraProjectPublicConfig,
      error: [HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get project public config",
        summary: "Get host-aware project white-label config",
        description:
          "Returns resolved public branding and authentication options through the proxied auth API.",
      }),
    ),
  )
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
    HttpApiEndpoint.post("uploadUserImage", "/auth/image/upload", {
      payload: ExtraImageUploadMultipartPayload,
      success: ExtraUploadedAsset,
      error: [
        ExtraBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Upload image",
        summary: "Upload an authenticated image asset",
        description:
          "Accepts a multipart image upload and stores it as an authenticated image asset for profiles, organizations, and branding.",
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
