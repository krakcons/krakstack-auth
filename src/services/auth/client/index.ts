import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { apiKeyClient } from "@better-auth/api-key/client";

export const KRAK_ORGANIZATION_SLUG = "krak";
export const authBaseUrl = import.meta.env.VITE_KRAKSTACK_AUTH_URL;

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    lastLoginMethodClient(),
    organizationClient(),
    twoFactorClient({
      twoFactorPage: "/2fa",
    }),
    apiKeyClient(),
    oauthProviderClient(),
    genericOAuthClient(),
  ],
});

export const ensureKrakOrganizationSelected = async () => {
  const result = await authClient.organization.setActive({
    organizationSlug: KRAK_ORGANIZATION_SLUG,
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Krak organization is required");
  }
};
