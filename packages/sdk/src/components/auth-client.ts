import { apiKeyClient } from "@better-auth/api-key/client";
import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";

const additionalFields = {
  session: {
    impersonatedByOrganizationId: {
      type: "string",
      required: false,
      input: false,
    },
  },
} as const;

type AuthUiClientPlugins = [
  ReturnType<typeof inferAdditionalFields<never, typeof additionalFields>>,
  ReturnType<typeof adminClient<{}>>,
  ReturnType<typeof emailOTPClient>,
  ReturnType<typeof lastLoginMethodClient>,
  ReturnType<typeof organizationClient<{}>>,
  ReturnType<typeof twoFactorClient>,
  ReturnType<typeof apiKeyClient>,
  ReturnType<typeof genericOAuthClient>,
];

const authUiClientPlugins: AuthUiClientPlugins = [
  inferAdditionalFields<never, typeof additionalFields>(additionalFields),
  adminClient(),
  emailOTPClient(),
  lastLoginMethodClient({
    cookieName: "krakstack-auth.last_used_login_method",
  }),
  organizationClient(),
  twoFactorClient(),
  apiKeyClient(),
  genericOAuthClient(),
];

type AuthUiClientOptions = {
  baseURL?: string | undefined;
  plugins: AuthUiClientPlugins;
};

export type AuthUiClient = ReactAuthClient<AuthUiClientOptions>;

export const createAuthUiClient = (baseUrl?: string | undefined) =>
  createAuthClient<AuthUiClientOptions>({
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    plugins: authUiClientPlugins,
  });
