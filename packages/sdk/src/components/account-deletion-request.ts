import { Effect } from "effect";
import { authHttpClient } from "./auth-client-api.js";

export const requestAccountDeletion = (password: string, baseUrl?: string) =>
  authHttpClient(baseUrl).pipe(
    Effect.flatMap((client) =>
      client.auth.deleteUser({
        // Better Auth accepts an absent password, not null. Explicit undefined
        // values are encoded as null by the HTTP API's JSON codec.
        payload: password ? { password } : {},
      }),
    ),
  );
