import {
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  AuthBadRequest,
  AuthOkResponse,
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
  .annotateMerge(
    OpenApi.annotations({
      title: "Auth",
      description: "Custom KrakStack authentication endpoints.",
    }),
  );
