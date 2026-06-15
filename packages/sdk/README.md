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

Users:

- `backend.listUsersByIds({ query: { ids } })` - returns matching users and missing IDs for a comma-separated ID list.
- `backend.getUser({ params: { id } })` - returns one user by ID.

Organizations:

- `backend.listOrganizations({ query: { ids } })` - returns matching organizations and missing IDs for a comma-separated ID list.
- `backend.listOrganizations({ query: { userId } })` - returns organizations for one user.
- `backend.getOrganization({ params: { id } })` - returns one organization by ID.
- `backend.getUserActiveOrganization({ params: { userId } })` - returns the active organization ID for one user.
- `frontend.presignOrganizationLogoUpload({ payload })` - returns a presigned organization logo upload URL.

Members:

- `backend.getActiveMember({ params: { organizationId, userId } })` - returns one user's membership and role in an organization.
- `backend.listOrganizationMembers({ params: { organizationId } })` - returns organization members with user contact details.

```ts
import { Effect } from "effect";
import { AuthClient } from "@krak-stack/auth";

const users = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* AuthClient;
    return yield* client.backend.listUsersByIds({
      query: { ids: "user_1,user_2" },
    });
  }).pipe(Effect.provide(AuthClient.layer)),
);

const organizations = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* AuthClient;
    return yield* client.backend.listOrganizations({
      query: { userId: "user_1" },
    });
  }).pipe(Effect.provide(AuthClient.layer)),
);
```

The frontend subpath also exports `FrontendApiClient` for Atom-based browser state.

## Components

```tsx
import { OrganizationSwitcher, UserButton } from "@krak-stack/auth";

<OrganizationSwitcher side="bottom" />
<UserButton signOutRedirect="/" side="bottom" />
```
