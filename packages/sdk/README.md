# @krak-stack/auth

Typed Effect contracts, server authentication middleware, project authorization primitives, and React authentication components for Krakstack Auth.

## Install

```bash
bun add @krak-stack/auth effect
```

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

## React Components

The component bundle uses the peer dependencies declared in `package.json` and Krakstack/shadcn UI primitives from `@krak-stack/registry`. The server-only entry points have a smaller integration boundary.

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

## Authorization

Define project permissions with `defineProjectAccess`, resolve actors with `ActorRequired`, and enforce backend policies with `withPolicy`. Frontend permission helpers control presentation only.

See the [RBAC guide](https://auth.krakstack.net/en/docs/rbac).
