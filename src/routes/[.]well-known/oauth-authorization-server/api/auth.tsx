import { createFileRoute } from "@tanstack/react-router";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { authForRequest } from "@/services/auth/config";

const handler = async (request: Request) =>
  oauthProviderAuthServerMetadata(await authForRequest(request), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  })(request);

export const Route = createFileRoute(
  "/.well-known/oauth-authorization-server/api/auth",
)({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
    },
  },
});
