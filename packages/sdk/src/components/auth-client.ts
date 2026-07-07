import type { apiKeyClient } from "@better-auth/api-key/client";
import type {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import type { createAuthClient } from "better-auth/react";

export type AuthUiClient = ReturnType<
  typeof createAuthClient<{
    plugins: [
      ReturnType<typeof adminClient>,
      ReturnType<typeof emailOTPClient>,
      ReturnType<typeof lastLoginMethodClient>,
      ReturnType<typeof organizationClient>,
      ReturnType<typeof twoFactorClient>,
      ReturnType<typeof apiKeyClient>,
      ReturnType<typeof genericOAuthClient>,
    ];
  }>
>;
