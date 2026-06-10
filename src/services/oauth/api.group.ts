import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
import { Schema } from "effect";

import {
  CreateOAuthClientPayload,
  OAuthClientAdmin,
  OAuthClientIdParams,
  OAuthClientPublicConfig,
  UpdateOAuthClientPayload,
} from "./schema";
import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

export const OAuthClientsApiGroup = HttpApiGroup.make("oauthClients")
  .add(
    HttpApiEndpoint.get("listOAuthClients", "/oauth/clients", {
      success: Schema.Array(OAuthClientAdmin),
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List OAuth clients",
        summary: "List OAuth clients for administrators",
        description:
          "Returns OAuth client records including editable white-label metadata.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("createOAuthClient", "/oauth/clients", {
      payload: CreateOAuthClientPayload,
      success: OAuthClientAdmin,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Create OAuth client",
        summary: "Create an OAuth client for administrators",
        description:
          "Registers a public PKCE OAuth client with redirect URIs, scopes, and white-label metadata.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "getOAuthClientConfig",
      "/oauth/clients/:clientId/config",
      {
        params: OAuthClientIdParams,
        success: OAuthClientPublicConfig,
        error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Get OAuth client public config",
        summary: "Get public OAuth client white-label config",
        description:
          "Returns logo, sanitized theme CSS, and resolved authentication options for an OAuth client.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.patch("updateOAuthClient", "/oauth/clients/:clientId", {
      params: OAuthClientIdParams,
      payload: UpdateOAuthClientPayload,
      success: OAuthClientAdmin,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Update OAuth client",
        summary: "Update OAuth client white-label settings",
        description:
          "Updates logo URL and schema-validated metadata for an OAuth client.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "presignOAuthClientLogoUpload",
      "/oauth/clients/logo/presign",
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
        title: "Presign OAuth client logo upload",
        summary: "Create a presigned OAuth client logo upload URL",
        description:
          "Returns a short-lived S3 upload URL and the stable asset URL to store on an OAuth client.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "OAuth clients",
      description: "OAuth client white-label configuration endpoints.",
    }),
  );
