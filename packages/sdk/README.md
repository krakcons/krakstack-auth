# @krak-stack/auth

Effect schemas and typed HttpApi clients for KrakStack Auth.

## Install

```sh
bun add @krak-stack/auth effect
```

## Environment

- `VITE_KRAKSTACK_AUTH_URL` - KrakStack Auth origin
- `KRAKSTACK_AUTH_SERVICE_API_KEY` - service API key for server clients

## Backend Auth API

Users:

- `listUsersByIds({ query: { ids } })` - returns matching users and missing IDs for a comma-separated ID list.
- `getUser({ params: { id } })` - returns one user by ID.

Organizations:

- `listOrganizationsByIds({ query: { ids } })` - returns matching organizations and missing IDs for a comma-separated ID list.
- `getOrganization({ params: { id } })` - returns one organization by ID.

```ts
import { Effect } from "effect";
import { AuthClient } from "@krak-stack/auth/backend";

const users = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* AuthClient;
    return yield* client.listUsersByIds({
      query: { ids: "user_1,user_2" },
    });
  }).pipe(Effect.provide(AuthClient.layer)),
);
```

## Frontend Auth API

```ts
import { Effect } from "effect";
import { AuthClient } from "@krak-stack/auth/frontend";

const organizations = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* AuthClient;
    return yield* client.listUserOrganizations({
      params: { userId: "user_1" },
    });
  }).pipe(Effect.provide(AuthClient.layer)),
);
```

The frontend subpath also exports `FrontendApiClient` for Atom-based browser state.

## Components

```tsx
import { OrganizationSwitcher, UserButton } from "@krak-stack/auth/components";

<OrganizationSwitcher side="bottom" />
<UserButton signOutRedirect="/" side="bottom" />
```
