# Krakstack Auth

Self-hosted identity infrastructure built with Better Auth, PostgreSQL, Effect, and TanStack Start. Krakstack Auth centralizes credentials, sessions, users, organizations, OAuth clients, API keys, two-factor authentication, project branding, and custom auth domains.

Krakstack Auth is self-hosted software. There is no managed cloud service or public customer administration service at `auth.krakstack.net`; that host serves the project documentation and the maintainer's own instance.

## Documentation

The canonical documentation is available at [auth.krakstack.net/en/docs](https://auth.krakstack.net/en/docs):

- [Application quickstart](https://auth.krakstack.net/en/docs/quickstart)
- [Choose an integration](https://auth.krakstack.net/en/docs/setup)
- [Architecture and trust boundaries](https://auth.krakstack.net/en/docs/architecture)
- [Self-hosting](https://auth.krakstack.net/en/docs/self-hosting)
- [Configuration reference](https://auth.krakstack.net/en/docs/configuration)
- [SDK exports](https://auth.krakstack.net/en/docs/sdk)
- [API reference](https://auth.krakstack.net/en/docs/api-reference)
- [RBAC](https://auth.krakstack.net/en/docs/rbac)
- [Security](https://auth.krakstack.net/en/docs/security)

French documentation is available at [auth.krakstack.net/fr/docs](https://auth.krakstack.net/fr/docs).

## Integration Boundaries

Krakstack Auth supports three application boundaries:

| Boundary             | Intended use                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Same-origin proxy    | Recommended for first-party Web applications                                                     |
| OAuth/OIDC           | Confidential server-backed Web clients using authorization code, PKCE, and `client_secret_basic` |
| Custom auth hostname | Branded central authentication routed through a registered domain                                |

Consumer applications remain responsible for resource authorization and tenant-scoped database access. Authentication establishes an actor; it does not authorize application records.

## Deployment Status

The current GHCR image is the official deployment artifact and embeds official-instance `VITE_*` values at build time. It is not yet demonstrated as a generic runtime-configurable image for another auth origin. Build a deployment-specific image and review the [self-hosting limitations](https://auth.krakstack.net/en/docs/self-hosting) before operating another instance.

## Source Development

```bash
cp .env.example .env
bun install
bun run db:migrate
bun run dev
```

| Command                   | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `bun run dev`             | Start the development server on port `3001`  |
| `bun run build`           | Build the SDK and application                |
| `bun run test`            | Run Vitest                                   |
| `bun run type:check`      | Check TypeScript                             |
| `bun run lint`            | Run Oxlint                                   |
| `bun run fmt`             | Format with Oxfmt                            |
| `bun run auth:generate`   | Generate reference Better Auth SQL in `tmp/` |
| `bun run db:migrate`      | Apply Effect SQL migrations                  |
| `bun run db:migrate:test` | Apply migrations to `TEST_DATABASE_URL`      |

Database-backed service tests must use `TEST_DATABASE_URL`, never `DATABASE_URL`.

### Database migrations

Migrations use `PgMigrator` in `src/db/migrate.ts`. Add new numbered Effect migrations in `src/db/migrations/` and register them in the loader. `bun run start` runs migrations before starting the production server.

The first Effect migration preserves the historical SQL in `src/db/migrations/legacy/`. On existing databases it reads the legacy migration ledger and skips already-applied migrations; on fresh databases it applies the complete history. Keep these SQL files in deployment artifacts and use Effect migrations exclusively. Treat `auth:generate` output as a reference for writing reviewed Effect migrations, not as an application migration.

## Stack

| Layer        | Technology                         |
| ------------ | ---------------------------------- |
| Runtime      | Bun                                |
| Application  | TanStack Start and React           |
| Identity     | Better Auth and OAuth Provider     |
| Services     | Effect and Effect HttpApi          |
| Database     | PostgreSQL and Effect SQL          |
| Styling      | Tailwind CSS and shadcn components |
| Localization | Paraglide.js and Inlang            |
