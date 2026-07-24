# Krakstack Auth

Self-hosted identity infrastructure built with Better Auth, PostgreSQL, Effect, and TanStack Start. Krakstack Auth packages credentials, sessions, users, organizations, OAuth clients, API keys, two-factor authentication, project branding, and custom auth domains into one service so applications do not have to assemble them independently.

Krakstack Auth is currently **self-hosted software only**. There is no managed cloud service or public customer admin. This repository publishes a ready-to-run image at `ghcr.io/krakcons/krakstack-auth`; [auth.krakstack.net](https://auth.krakstack.net) hosts the project documentation and the maintainer's own instance.

## Documentation

The complete documentation is available at [auth.krakstack.net/docs](https://auth.krakstack.net/docs):

- [Setup methods](https://auth.krakstack.net/docs/setup)
- [Proxy setup](https://auth.krakstack.net/docs/proxy)
- [OAuth and OpenID Connect](https://auth.krakstack.net/docs/oauth)
- [Auth subdomains](https://auth.krakstack.net/docs/subdomain)
- [React components and CSS](https://auth.krakstack.net/docs/components)
- [Auth pages](https://auth.krakstack.net/docs/auth-pages)
- [API middleware](https://auth.krakstack.net/docs/middleware)
- [Domain registration](https://auth.krakstack.net/docs/domains)
- [Self-hosting](https://auth.krakstack.net/docs/self-hosting)
- [Security and operations](https://auth.krakstack.net/docs/security)

## Integration Methods

### Proxy (Recommended)

First-party applications should proxy `/api/auth/*` to Krakstack Auth. This keeps browser sessions on the application's origin while the central service remains the source of truth.

```tsx
import { proxyAuthRequest } from "@krak-stack/auth/server";
import { createFileRoute } from "@tanstack/react-router";

const proxyAuth = (request: Request) =>
  proxyAuthRequest(request, process.env.KRAKSTACK_AUTH_URL!);

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyAuth(request),
      POST: ({ request }) => proxyAuth(request),
      PUT: ({ request }) => proxyAuth(request),
      PATCH: ({ request }) => proxyAuth(request),
      DELETE: ({ request }) => proxyAuth(request),
    },
  },
});
```

### OAuth / OpenID Connect

Use OAuth authorization code flow with PKCE for third-party integrations, native clients, separately operated applications, or consumers that already support OIDC.

```text
Issuer: https://auth.example.com
Discovery: https://auth.example.com/.well-known/openid-configuration
```

Register exact redirect URIs in **Admin > Clients** and keep client secrets in server-side secret storage.

### Auth Subdomain

Register a dedicated hostname such as `auth.customer.example.com` for a branded central sign-in experience. Domains can be linked to projects or organizations and provisioned through Cloudflare or existing infrastructure.

## SDK and Components

Install the consumer package:

```bash
bun add @krak-stack/auth effect
```

Wrap React consumers with the provider:

```tsx
import { KrakstackAuthProvider } from "@krak-stack/auth";

<KrakstackAuthProvider
  locale="en"
  projectId={import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID}
>
  {children}
</KrakstackAuthProvider>;
```

The package exports `Signin`, `Signup`, `VerifyEmail`, `ResetPassword`, `TwoFactor`, `UserButton`, `OrganizationSwitcher`, `MemberRequired`, and typed auth hooks.

Add the package source to the application's global CSS so Tailwind detects component classes:

```css
@import "tailwindcss";
@import "@krak-stack/auth/tailwind.css";
```

Components use standard shadcn CSS variables and inherit the consumer application's theme.

## Auth Pages

The SDK provides forms while the consumer owns the routes and surrounding layout. Mount `KrakstackAuthProvider` above the auth pages, then create the following public paths:

| Route             | Component       |
| ----------------- | --------------- |
| `/sign-in`        | `Signin`        |
| `/sign-up`        | `Signup`        |
| `/verify-email`   | `VerifyEmail`   |
| `/reset-password` | `ResetPassword` |
| `/2fa`            | `TwoFactor`     |

```tsx
import { Signin } from "@krak-stack/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/sign-in")({
  component: () => <Signin />,
});
```

Repeat the route for the other components. `Signin` also links to `/forgot-password`; provide an application-owned password-reset request page or redirect that path to the central auth service.

Use a pathless auth layout to preserve a validated `redirect` query parameter and send already authenticated users back to the application. Use a separate protected parent route to redirect unauthenticated navigation to `/sign-in`. These browser guards improve navigation but do not replace backend authorization.

## Effect API Middleware

Apply `AuthMiddleware` to the Effect HttpApi contract and provide its live layer:

```ts
import { AuthMiddleware } from "@krak-stack/auth/server";

export const AppApi = HttpApi.make("AppApi")
  .add(ApplicationApiGroup)
  .prefix("/api")
  .middleware(AuthMiddleware);

export const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(AuthMiddleware.layer()),
  Layer.provide(FetchHttpClient.layer),
);
```

The middleware supports browser session cookies and trusted `x-api-key` clients and provides `AuthService` to handlers. Protected handlers must explicitly choose the identity they require:

```ts
const auth = yield * AuthService;
const session = yield * auth.requireUserOrganization();

const userId = session.user.id;
const organizationId = session.session.activeOrganizationId;
```

Available methods are `getSession()`, `requireSession()`, `requireUser()`, `requireOrganization()`, and `requireUserOrganization()`. Always use the resulting identity in database predicates and repeat membership or role checks for privileged operations.

## Self-Hosting

The deployment workflow publishes `linux/amd64` images to:

```text
ghcr.io/krakcons/krakstack-auth
```

Every successful `main` build publishes `latest` and an immutable full Git commit SHA. Use `latest` to evaluate updates and pin a tested SHA in production. Available releases are listed in the [GitHub package](https://github.com/krakcons/krakstack-auth/pkgs/container/krakstack-auth).

```bash
docker pull ghcr.io/krakcons/krakstack-auth:latest
```

Minimal Compose deployment:

```yaml
services:
  auth:
    image: ghcr.io/krakcons/krakstack-auth:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://krakstack:${POSTGRES_PASSWORD}@postgres:5432/krakstack_auth
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: https://auth.example.com
      VITE_SITE_URL: https://auth.example.com
      BETTER_AUTH_TRUSTED_ORIGINS: https://auth.example.com,https://app.example.com
      BETTER_AUTH_VALID_AUDIENCES: https://auth.example.com,https://app.example.com
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: krakstack_auth
      POSTGRES_USER: krakstack
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U krakstack -d krakstack_auth"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
```

The container applies Drizzle migrations before starting the application on port `3000`. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`, keep it in a secret manager, and terminate TLS in front of the container.

## Environment

Consumer applications typically use:

```env
KRAKSTACK_AUTH_URL=https://auth.example.com
VITE_KRAKSTACK_AUTH_URL=https://auth.example.com
VITE_KRAKSTACK_AUTH_PROJECT_ID=project_id
KRAKSTACK_AUTH_SERVICE_API_KEY=server_only_secret
```

`KRAKSTACK_AUTH_URL` and `KRAKSTACK_AUTH_SERVICE_API_KEY` are server-only. Never expose the service API key through a `VITE_*` variable.

The auth service requires:

```env
DATABASE_URL=postgres://user:password@postgres:5432/krakstack_auth
BETTER_AUTH_SECRET=long_random_secret
BETTER_AUTH_URL=https://auth.example.com
VITE_SITE_URL=https://auth.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://app.example.com
BETTER_AUTH_VALID_AUDIENCES=https://auth.example.com,https://app.example.com
```

Optional integrations include Google OAuth, SES transactional email, S3-compatible asset storage, and Cloudflare custom hostname management.

## Auth Endpoints

| Path                                               | Purpose                             |
| -------------------------------------------------- | ----------------------------------- |
| `/api/auth/*`                                      | Better Auth API                     |
| `/sign-in`                                         | Central sign-in page                |
| `/sign-up`                                         | Central sign-up page                |
| `/consent`                                         | OAuth consent page                  |
| `/.well-known/openid-configuration`                | OIDC discovery                      |
| `/api/auth/.well-known/openid-configuration`       | Issuer-path OIDC discovery          |
| `/.well-known/oauth-authorization-server/api/auth` | OAuth authorization server metadata |
| `/api/auth/ok`                                     | Auth health check                   |

## Source Development

Source development is only required when contributing to Krakstack Auth itself. Self-hosters should use the published GHCR image.

```bash
cp .env.example .env
bun install
bun run auth:migrate
bun run dev
```

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `bun run dev`           | Start the auth server on port `3001` |
| `bun run build`         | Build the SDK and application        |
| `bun run test`          | Run the Vitest suite                 |
| `bun run lint`          | Run Oxlint                           |
| `bun run fmt`           | Run Oxfmt                            |
| `bun run type:check`    | Run TypeScript checks                |
| `bun run auth:generate` | Generate the Better Auth schema      |
| `bun run auth:migrate`  | Apply Better Auth migrations         |

## Stack

| Layer     | Technology                       |
| --------- | -------------------------------- |
| Runtime   | Bun                              |
| Framework | TanStack Start                   |
| Auth      | Better Auth + OAuth Provider     |
| Services  | Effect + Effect HttpApi          |
| Database  | PostgreSQL + Drizzle ORM         |
| Styling   | Tailwind CSS + shadcn components |
| i18n      | Paraglide.js + inlang            |
