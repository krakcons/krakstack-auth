import { createFileRoute } from "@tanstack/react-router";

const handler = async (request: Request) => {
  const { apiHandler } = await import("@/api-handler.server");
  return apiHandler(request);
};

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
      PATCH: ({ request }) => handler(request),
      DELETE: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
