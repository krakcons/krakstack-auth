import { createFileRoute } from "@tanstack/react-router";

const handler = async (request: Request) => {
  const { oauthAuthorizationServerHandler } =
    await import("@/services/auth/metadata.server");
  return oauthAuthorizationServerHandler(request);
};

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: ({ request }) => handler(request),
      },
    },
  },
);
