import { createFileRoute } from "@tanstack/react-router";

const handler = async (request: Request) => {
  const { openIdConfigurationHandler } =
    await import("@/services/auth/metadata.server");
  return openIdConfigurationHandler(request);
};

export const Route = createFileRoute("/.well-known/openid-configuration")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
    },
  },
});
