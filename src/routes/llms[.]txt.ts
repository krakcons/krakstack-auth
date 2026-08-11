import { createFileRoute } from "@tanstack/react-router";

const content = `# KrakStack Auth

> KrakStack Auth is an open-source, self-hosted Better Auth server for TypeScript applications.

## Documentation

- Introduction (English): https://auth.krakstack.net/en/docs
- Introduction (French): https://auth.krakstack.net/fr/docs
- API reference: https://auth.krakstack.net/api/docs
- Documentation source: https://github.com/krakcons/krakstack-auth

## Key facts

- Authentication is self-hosted on your infrastructure with PostgreSQL-backed sessions.
- It supports OAuth 2.1, OIDC discovery, organizations, branded auth pages, and typed React components.
- The service is built on Better Auth, TanStack Start, Effect, and TypeScript.

## Source

- Website: https://auth.krakstack.net
- GitHub: https://github.com/krakcons/krakstack-auth
- KrakStack registry: https://krakstack.net
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(content, {
          headers: {
            "cache-control": "public, max-age=3600",
            "content-type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
});
