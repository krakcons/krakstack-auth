import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { createFileRoute } from "@tanstack/react-router";

import { auth } from "@/services/auth/config";
import { isAuthorizedAuthHost } from "@/lib/auth-domains";

const handler = oauthProviderAuthServerMetadata(auth, {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
  },
});

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: async ({ request }) =>
          (await isAuthorizedAuthHost(request))
            ? handler(request)
            : Response.json({ error: "Unknown auth host" }, { status: 404 }),
      },
    },
  },
);
