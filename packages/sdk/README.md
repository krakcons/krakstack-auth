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

Atom clients are also exported as `BackendApiClient` and `FrontendApiClient`.
