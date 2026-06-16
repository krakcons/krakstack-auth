import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import {
  GetSessionPayload,
  GetSessionResponse,
  TooManyRequests,
} from "./schema";

export const BetterAuthApiGroup = HttpApiGroup.make("betterAuth")
  .add(
    HttpApiEndpoint.post("getSession", "/get-session", {
      payload: GetSessionPayload,
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
  .annotateMerge(
    OpenApi.annotations({
      title: "Better Auth",
      description: "Better Auth-owned browser session endpoints.",
    }),
  );

export const BetterAuthApi = HttpApi.make("BetterAuthApi")
  .add(BetterAuthApiGroup)
  .prefix("/api/auth");
