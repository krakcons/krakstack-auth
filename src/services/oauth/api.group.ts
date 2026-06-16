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
  OAuthClientCreated,
  OAuthClientIdParams,
  UpdateOAuthClientPayload,
} from "./schema";
import { ProjectPublicConfig } from "@/services/projects/schema";
import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

export const AdminOAuthClientsApiGroup = HttpApiGroup.make("oauthClients")
  .add(
    HttpApiEndpoint.get("listOAuthClients", "/admin/oauth/clients", {
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
    HttpApiEndpoint.post("createOAuthClient", "/admin/oauth/clients", {
      payload: CreateOAuthClientPayload,
      success: OAuthClientCreated,
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
          "Registers an OAuth client with redirect URIs, scopes, white-label metadata, and a generated client secret returned once.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "getOAuthClientConfig",
      "/oauth/clients/:clientId/config",
      {
        params: OAuthClientIdParams,
        success: ProjectPublicConfig,
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
    HttpApiEndpoint.patch(
      "updateOAuthClient",
      "/admin/oauth/clients/:clientId",
      {
        params: OAuthClientIdParams,
        payload: UpdateOAuthClientPayload,
        success: OAuthClientAdmin,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Update OAuth client",
        summary: "Update OAuth client white-label settings",
        description:
          "Updates logo URL and schema-validated metadata for an OAuth client.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.delete(
      "deleteOAuthClient",
      "/admin/oauth/clients/:clientId",
      {
        params: OAuthClientIdParams,
        success: OAuthClientAdmin,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Delete OAuth client",
        summary: "Delete an OAuth client",
        description: "Deletes an OAuth client and returns the deleted record.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "presignOAuthClientLogoUpload",
      "/admin/oauth/clients/logo/presign",
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
      description: "Administrative OAuth client white-label endpoints.",
    }),
  );
