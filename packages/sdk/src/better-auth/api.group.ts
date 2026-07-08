import { OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  GetSessionResponse,
  OrganizationImpersonateUserPayload,
  OrganizationImpersonateUserResponse,
  TooManyRequests,
} from "./schema";

export * from "./schema";
export type { Session, User } from "../schema";

export const BetterAuthApiGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("getSession", "/get-session", {
      success: GetSessionResponse,
      error: [
        HttpApiError.BadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        TooManyRequests,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get session",
        summary: "Get current Better Auth session",
        description:
          "Auth required. Returns the current Better Auth session and user. This endpoint is implemented directly by Better Auth.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationImpersonateUser",
      "/organization/impersonate-user",
      {
        payload: OrganizationImpersonateUserPayload,
        success: OrganizationImpersonateUserResponse,
        error: [
          HttpApiError.BadRequest,
          HttpApiError.Unauthorized,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ).annotateMerge(
      OpenApi.annotations({
        title: "Organization impersonate user",
        summary: "Create an organization impersonation session",
        description:
          "Service API key and actor session cookie required. Creates a target user session marked with the actor user and impersonating organization. The response includes the Better Auth session Set-Cookie header plus the restore cookie used by /auth/admin/stop-impersonating.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Better Auth",
      description: "Better Auth-owned browser session endpoints.",
    }),
  );
