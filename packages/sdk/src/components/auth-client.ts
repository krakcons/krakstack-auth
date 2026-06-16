import type { apiKeyClient } from "@better-auth/api-key/client";
import type {
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import type { createAuthClient } from "better-auth/react";

export type AuthUiClient = ReturnType<
  typeof createAuthClient<{
    plugins: [
      ReturnType<typeof organizationClient>,
      ReturnType<typeof twoFactorClient>,
      ReturnType<typeof apiKeyClient>,
    ];
  }>
>;
