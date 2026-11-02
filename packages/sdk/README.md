# @krak-stack/auth

Typed Effect contracts, server authentication middleware, project authorization primitives, and React authentication components for Krakstack Auth.

## Install

```bash
bun add @krak-stack/auth effect
```

### Effect forms

React components use `@lucas-barake/effect-form-react@1.1.0`, which supports
stable Effect 4 without compatibility patches. When upgrading from the patched
betas, remove their `patchedDependencies` entries and patch files, update any
direct form dependencies or version overrides to `1.1.0`, and run `bun install`.
Server-only imports do not load the form libraries.

### Entry points

Choose a narrow package subpath for the runtime boundary:

| Entry point                      | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `@krak-stack/auth/server`        | Proxy, `AuthMiddleware`, `AuthService`, `ActorRequired`, and policies |
| `@krak-stack/auth/components`    | React provider, forms, account controls, and UI permission helpers    |
| `@krak-stack/auth/access`        | Typed project access definitions                                      |
| `@krak-stack/auth/access/matrix` | Generated permission matrix                                           |
| `@krak-stack/auth/api`           | Combined Effect HttpApi contracts                                     |
| `@krak-stack/auth/auth`          | Browser authentication HttpApi group and schemas                      |
| `@krak-stack/auth/schema`        | Shared schemas                                                        |
| `@krak-stack/auth/admin`         | Administrative API contract                                           |
| `@krak-stack/auth/extra`         | Browser-facing extra API contract                                     |

The complete export map is defined in `package.json` and documented at [auth.krakstack.net/en/docs/sdk](https://auth.krakstack.net/en/docs/sdk).

## Server Configuration

Server clients use:

```env
KRAKSTACK_AUTH_URL=https://auth.example.com
KRAKSTACK_AUTH_SERVICE_API_KEY=server_only_secret
```

`AuthClientConfig` accepts explicit `baseUrl` and redacted `apiKey` overrides. Never expose the service key through a `VITE_*` variable.

```ts
import { AuthService } from "@krak-stack/auth/server";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const auth = yield* AuthService;
  return yield* auth.requireUserOrganization();
});
```

Use `AuthMiddleware.layer()` to provide request headers and configuration in an Effect HttpApi application. See the [middleware guide](https://auth.krakstack.net/en/docs/middleware).

### Auth webhooks

`AuthMiddleware.layer({ onDeleteUser, onDeleteOrganization })` requires both cleanup callbacks; there is no opt-out or default
successful cleanup. The SDK automatically mounts `POST /api/webhooks/auth`.
Every consuming project supplies only its application-specific SQL cleanup:

```ts
import { AuthMiddleware } from "@krak-stack/auth/server";
import { Layer } from "effect";

const authentication = AuthMiddleware.layer({
  onDeleteUser: ({ userId }) => eraseLocalUserData(userId),
  onDeleteOrganization: ({ organizationId }) => eraseLocalOrganizationData(organizationId),
  // Optional: handle other Auth events. Validate event-specific data here.
  onWebhook: (webhook) => handleOtherAuthEvent(webhook),
}).pipe(Layer.provide(databaseLayer));
```

Set server-only `KRAKSTACK_AUTH_WEBHOOK_SECRET` (at least 32 characters) and
`VITE_KRAKSTACK_AUTH_PROJECT_ID`, or pass explicit `webhookSecret: Redacted<string>` and
`projectId` options. Missing/invalid configuration fails setup. The cleanup must
use the same SQL pool as the receiver; it executes in the receipt transaction.
Do not perform external side effects or launch unawaited work in the callback.

The middleware uses `WebhooksReceiver` from `@krak-stack/registry/webhooks`.
Receiver migrations create only deduplication receipts, not delivery tables or
workers. Signed `user.deletion_requested` envelopes have data
fields `projectId`, `userId`, and `scope: "account"`. Requests are
HMAC-authenticated, project-validated, limited to 16 KiB, and acknowledged only
after commit. The timestamp window is five minutes. Duplicates return 204;
changed content under the same signed `webhook-id` returns 409.
`organization.deletion_requested` routes validated data (
`projectId`, `organizationId`, `scope: "organization"`) to `onDeleteOrganization`.
Neither deletion event routes to `onWebhook`. Other
events retain their event-specific JSON data and route to `onWebhook`; without a
handler they return 400, never a successful acknowledgement. Cleanup failures
roll back the receipt and return 500 so delivery can retry.

Signatures cover `${webhookId}.${timestamp}.${rawBody}`. Upgrade sender and receiver
together: legacy signatures over only timestamp/body are rejected. Neither `requestId`
nor `version` is required in webhook data.

Explicitly schedule `WebhooksReceiver.cleanup()` for receipts older than 30 days;
handlers must remain idempotent after expiry. Central Auth uses Better Auth's
native delete-user flow and durably notifies connected projects after the user
has been removed. Configure the project's **Webhook URL** and copy its **Signing
secret** into the receiving server. Platform admins and organization owners must
transfer their roles before self-deleting. This does not guarantee that a project's
callback covers all personal data. Inventory invitations, logs, exports,
processors, and backups before claiming complete erasure. Use
`@krak-stack/registry` `0.1.61` or later and upgrade sender and receiver together.
Account and organization deletion controls are temporarily hidden in production
builds, including admin organization deletion. Development controls remain available;
this UI rollout gate does not disable server endpoints or change authorization.

**Français :** `AuthMiddleware.layer({ onDeleteUser, onDeleteOrganization })` exige les deux fonctions de nettoyage et monte la route de
réception automatiquement. Chaque projet doit fournir son nettoyage SQL et le
secret de signature côté serveur ; une configuration absente empêche le
démarrage. Le reçu et le nettoyage sont validés dans la même transaction.
Un doublon retourne 204, un conflit de contenu 409 et un échec de nettoyage 500.
La réception seule ne démarre aucun travailleur d’envoi. Planifier le nettoyage
des reçus après 30 jours et conserver un traitement idempotent. Le parcours de
suppression central utilise Better Auth et notifie les projets après suppression
de l’utilisateur. Configurez l’URL du webhook et son secret de signature dans le
projet. Les administrateurs de plateforme et propriétaires d’organisation doivent
d’abord transférer leurs rôles. `onDeleteUser` reçoit les données validées de suppression du compte ;
`onDeleteOrganization` reçoit celles de suppression de l’organisation.
Le gestionnaire facultatif `onWebhook` reçoit les
autres événements avec leurs données JSON ; sans gestionnaire, ils retournent 400.
La déduplication utilise l’en-tête `webhook-id` signé. Aucun `requestId` n’est requis dans les données.
La signature couvre `${webhookId}.${timestamp}.${rawBody}`. Mettre à jour les deux côtés ensemble :
les anciennes signatures sont refusées. Aucun champ `version` n’est requis dans les données.
Ce mécanisme ne garantit pas, à lui seul, la conformité ou l’effacement complet.
Utilisez `@krak-stack/registry` `0.1.61` ou une version ultérieure et mettez à jour les deux côtés ensemble.
Les commandes de suppression de compte et d’organisation, y compris dans l’administration,
sont temporairement masquées en production. Elles restent disponibles en développement ;
ce masquage ne désactive pas les points d’entrée serveur ni leurs contrôles d’autorisation.

`AuthMiddleware` also annotates request logs and spans with verified user,
organization, and actor IDs using its existing session lookup. Missing sessions
are anonymous; auth service failures are not silently treated as anonymous.
`ActorRequired` remains responsible for project authorization and `CurrentActor`.

For plain `HttpRouter` routes, use the same authentication through
`AuthMiddleware.routerLayer()`. For example, browser Events ingestion can inherit
verified identity without an `Events.layer({ identity })` callback:

```ts
import { AuthMiddleware } from "@krak-stack/auth/server";
import { HttpApiOtlp } from "@krak-stack/registry/opentelemetry/api";
import { Events } from "@krak-stack/registry/events";
import { Layer } from "effect";

const telemetry = HttpApiOtlp.layer.pipe(
  Layer.provide(AuthMiddleware.routerLayer({ paths: ["/api/otel/v1/logs"] })),
  Layer.provide(Events.ingestionLayer),
  Layer.provide(eventsLayer),
);
```

Here `eventsLayer` is the configured Events layer, with SQL provided when
persistence is needed. `paths` limits auth lookup to the listed URL pathnames;
without it, the middleware covers every route it is provided to. The router
adapter uses the same auth configuration and organization-impersonation policy
as `AuthMiddleware.layer()`. It does not grant permissions or provide `CurrentActor`.

## React Components

The component bundle uses the optional peer dependencies declared in `package.json` and Krakstack/shadcn UI primitives from `@krak-stack/registry`. Install the component peers used by your application. Server middleware needs `effect`, the matching registry package, and an SQL pool; React component peers are not needed for server-only use.

When components are configured, register their Tailwind source:

```css
@import "tailwindcss";
@import "@krak-stack/auth/tailwind.css";
```

The React components use the exported Effect query atoms and the owned authentication HTTP group. Browser requests include credentials so hosted components can resolve sessions across configured origins.

`UserButton` accepts `menuActions` for app-owned menu items such as dashboard or workspace links:

```tsx
import { UserButton } from "@krak-stack/auth/components";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

<UserButton
  menuActions={
    <DropdownMenuItem render={<a href="/dashboard" />}>
      Dashboard
    </DropdownMenuItem>
  }
  signOutRedirect="/"
/>;
```

See [React components and CSS](https://auth.krakstack.net/en/docs/components) for the provider and component requirements.

### Locale syncing

Nest `KrakstackAuthProvider` inside `KrakstackProvider`. The auth provider reads
the registry locale context and saves it to the signed-in user's `locale` when
it differs. It does not accept a `locale` prop or restore the interface language
from the saved account preference. Use `LocaleSwitcher` directly from
`@krak-stack/registry/locale-switcher` with your application's language-change
callback; no auth-specific selector wrapper is needed.

The context is authoritative, including after a Paraglide reload. Public pages
outside the auth provider change only the browser locale; pages inside it can
update the account even when the language comes from a localized URL. Signed-out
visitors do not trigger user updates. An optional `onLocaleSyncError` callback
lets the application display a localized save error without a retry loop.

Existing consumers already nesting `KrakstackAuthProvider` inside
`KrakstackProvider` only need an SDK version update after the auth server is
deployed with locale support. No consumer database migration, new provider prop,
or selector change is required. Impersonated sessions do not sync preferences.

Krakstack Auth emails use the recipient's saved language, falling back to the
request locale and then English when no valid saved preference exists.
See [locale syncing](https://auth.krakstack.net/en/docs/components#locale-syncing)
for setup, lifecycle behavior, and background-notification guidance.

## Authorization

Define project permissions with `defineProjectAccess`, resolve actors with `ActorRequired`, and enforce backend policies with `withPolicy`. Frontend permission helpers control presentation only.

`AuthMiddleware` annotates the current span, child spans and handler logs with verified attribution:

| Attribute                  | User session                           | User-owned API key         | Organization-owned API key |
| -------------------------- | -------------------------------------- | -------------------------- | -------------------------- |
| `app.actor.type`           | `user`                                 | `user`                     | `organization`             |
| `app.actor.id`             | User ID                                | Owner user ID              | Owner organization ID      |
| `app.auth.method`          | `session`                              | `api_key`                  | `api_key`                  |
| `app.auth.credential.id`   | Omitted                                | API-key record ID          | API-key record ID          |
| `app.auth.impersonator.id` | Initiating admin ID when impersonating | Omitted                    | Omitted                    |
| `user.id`                  | User ID                                | Owner user ID              | Omitted                    |
| `user.roles`               | Organization roles                     | Owner's organization roles | Empty array                |
| `organization.id`          | Active organization ID                 | Active organization ID     | Owner organization ID      |

`user.id` and `user.roles` follow OpenTelemetry user semantic conventions. Roles are added by `ActorRequired`, not session-only router middleware. Names, photos, email addresses, API-key values, and session tokens are not emitted. OTel defines `user.name` as login/username and `user.full_name` as full name; neither is needed for attribution here. The `app.actor.*`, `app.auth.*` and existing `organization.id` fields are application conventions. The public authorization model still uses `type: "apiKey"`, but telemetry identifies its owning user or organization as the responsible principal and records the key separately as a credential. This replaces the previous `app.actor.owner.*` fields and API-key actor IDs; telemetry consumers must migrate together with the SDK. Audit consumers resolve current names/photos from organization membership for display, rather than copying them into logs. MCP and AI execution context belongs to the respective integration layers and does not replace the authenticated actor.

Auth-owned user, organization and actor annotations replace the inherited set,
preventing stale user/API-key owner attribution. Unrelated request, MCP and agent
context is preserved, and scoped log/child-span context is restored afterward.
Stale fields on an already-created current span are cleared to empty strings
because the tracer interface has no attribute-removal method; handler logs and
new child spans omit those fields entirely.

`ActorRequired` resolves the project actor, enforces actor constraints, and provides
`CurrentActor`. It adds `user.roles` to logs and spans from the verified active
organization membership, not the global user role. Events recorded in the handler
retain that role snapshot even after membership changes. Session-only router
middleware does not look up roles. When supplying `AuthService` directly without
`AuthMiddleware`, only the verified roles are added; session profile/actor
attribution still requires `AuthMiddleware`.

See the [RBAC guide](https://auth.krakstack.net/en/docs/rbac).
