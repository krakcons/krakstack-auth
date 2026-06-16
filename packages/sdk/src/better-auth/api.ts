import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { GetSessionResponse } from "./schema";

export const BetterAuthApiGroup = HttpApiGroup.make("betterAuth")
  .add(
    HttpApiEndpoint.get("getSession", "/get-session", {
      success: GetSessionResponse,
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get session",
        summary: "Get current Better Auth session",
        description:
          "Returns the current Better Auth session and user, or null when signed out. This endpoint is implemented directly by Better Auth.",
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
