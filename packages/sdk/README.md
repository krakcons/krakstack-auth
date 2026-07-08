# @krak-stack/auth

Effect schemas and typed HttpApi clients for KrakStack Auth.

## Install

```sh
bun add @krak-stack/auth effect
```

## Environment

- `VITE_KRAKSTACK_AUTH_URL` - KrakStack Auth origin
- `KRAKSTACK_AUTH_SERVICE_API_KEY` - service API key for server clients

## Auth Client

Better Auth:

- `getSession({ payload: {} })` - returns the current Better Auth session and user.

Users:

- `server.listUsersByIds({ query: { ids } })` - returns matching users and missing IDs for a comma-separated ID list.
- `server.getUser({ params: { id } })` - returns one user by ID.

Organizations:

- `server.listOrganizations({ query: { ids } })` - returns matching organizations and missing IDs for a comma-separated ID list.
- `server.listOrganizations({ query: { userId } })` - returns organizations for one user.
- `server.getOrganization({ params: { id } })` - returns one organization by ID.
- `server.getUserActiveOrganization({ params: { userId } })` - returns the active organization ID for one user.
- `extra.presign({ payload })` - returns a presigned organization logo upload URL.

Members:

- `server.getActiveMember({ params: { organizationId, userId } })` - returns one user's membership and role in an organization.
- `server.listOrganizationMembers({ params: { organizationId } })` - returns organization members with user contact details.

```ts
import { Effect } from "effect";
import { AuthClient } from "@krak-stack/auth";

const users = await Effect.runPromise(
  Effect.gen(function* () {
    const auth = yield* AuthClient;
    return yield* auth.server.listUsersByIds({
      query: { ids: "user_1,user_2" },
    });
  }).pipe(Effect.provide(AuthClient.layer)),
);

const organizations = await Effect.runPromise(
  Effect.gen(function* () {
    const auth = yield* AuthClient;
    return yield* auth.server.listOrganizations({
      query: { userId: "user_1" },
    });
  }).pipe(Effect.provide(AuthClient.layer)),
);
```

The extra subpath also exports `ExtraApiClient` for Atom-based browser state.

## Components

```tsx
import { OrganizationSwitcher, UserButton } from "@krak-stack/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

<OrganizationSwitcher
  menuActions={
    <DropdownMenuItem render={<a href="/organization" />}>
      Dashboard
    </DropdownMenuItem>
  }
  side="bottom"
/>
<UserButton signOutRedirect="/" side="bottom" />
```
