import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  anonymousClient,
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { apiKeyClient } from "@better-auth/api-key/client";

export const KRAK_ORGANIZATION_SLUG = "krak";

const organizationSchema = {
  organization: {
    additionalFields: {
      userId: { type: "string", required: false },
      parentId: { type: "string", required: false },
    },
  },
} as const;
const additionalFields = {
  user: {
    metadata: { type: "json", required: false },
  },
} as const;
export const authBaseUrl =
  import.meta.env.VITE_KRAKSTACK_AUTH_URL ?? import.meta.env.VITE_SITE_URL;

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields(additionalFields),
    adminClient(),
    anonymousClient(),
    emailOTPClient(),
    lastLoginMethodClient({
      cookieName: "krakstack-auth.last_used_login_method",
    }),
    organizationClient({ schema: organizationSchema }),
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
