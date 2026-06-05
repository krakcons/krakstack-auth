import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
import { Schema } from "effect";

import {
  OAuthClientAdmin,
  OAuthClientIdParams,
  OAuthClientPublicConfig,
  UpdateOAuthClientPayload,
} from "./schema";

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
  .annotateMerge(
    OpenApi.annotations({
      title: "OAuth clients",
      description: "OAuth client white-label configuration endpoints.",
    }),
  );
