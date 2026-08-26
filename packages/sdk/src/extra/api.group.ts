import { Schema } from "effect";
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
  ExtraOrganizationPublicProfile,
  ExtraOrganizationPublicProfileQuery,
  ExtraProjectPublicConfig,
  ExtraProjectPublicConfigQuery,
  ExtraSetPasswordPayload,
  ExtraUpdateApiKeyPayload,
  ExtraUploadedAsset,
  ExtraVerifyApiKeyPayload,
  ExtraVerifyApiKeyResponse,
  ExtraVerifyPasswordPayload,
} from "./schema.js";

export * from "./schema.js";
export type { Organization, OrganizationMetadata } from "../schema.js";

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
    HttpApiEndpoint.patch("updateApiKey", "/auth/api-key/:keyId", {
      params: Schema.Struct({ keyId: Schema.NonEmptyString }),
      payload: Schema.Struct({
        configId: ExtraUpdateApiKeyPayload.fields.configId,
        name: ExtraUpdateApiKeyPayload.fields.name,
        enabled: ExtraUpdateApiKeyPayload.fields.enabled,
        permissions: ExtraUpdateApiKeyPayload.fields.permissions,
        referrers: ExtraUpdateApiKeyPayload.fields.referrers,
      }),
      success: ExtraOkResponse,
      error: [
        ExtraBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Update API key",
        summary: "Update an API key",
        description:
          "Updates API key details and server-only permissions after verifying user ownership or organization key-management access.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "getOrganizationPublicProfile",
      "/auth/organization-profile",
      {
        query: ExtraOrganizationPublicProfileQuery,
        success: ExtraOrganizationPublicProfile,
        error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Get organization public profile",
        summary: "Get public organization display metadata",
        description:
          "Returns public organization metadata used by access and invitation screens.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("setPassword", "/auth/set-password", {
      payload: ExtraSetPasswordPayload,
      success: ExtraOkResponse,
      error: [
        ExtraBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
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
      error: [
        ExtraBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
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
      error: [
        ExtraBadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Create API key",
        summary: "Create an API key with optional permissions",
        description:
          "Creates a user or organization API key through the server API so server-only fields like permissions can be set.",
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
          "Verifies a user or organization API key and optional permissions.",
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
        HttpApiError.Forbidden,
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
      description: "KrakStack-specific authentication endpoints.",
    }),
  );
