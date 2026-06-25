import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { createFileRoute } from "@tanstack/react-router";

import { authForRequest } from "@/services/auth/config";

const handler = async (request: Request) =>
  oauthProviderOpenIdConfigMetadata(await authForRequest(request), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  })(request);

export const Route = createFileRoute("/.well-known/openid-configuration")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
    },
  },
});
