import { apiKeyClient } from "@better-auth/api-key/client";
import type { BetterAuthClientOptions } from "@better-auth/core";
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
import { createAuthClient, type ReactAuthClient } from "better-auth/react";

const additionalFields = {
  user: {
    metadata: {
      type: "json",
      required: false,
    },
  },
  session: {
    impersonatedByOrganizationId: {
      type: "string",
      required: false,
      input: false,
    },
  },
} as const;

const organizationSchema = {
  organization: {
    additionalFields: {
      userId: {
        type: "string",
        required: false,
      },
      parentId: {
        type: "string",
        required: false,
      },
    },
  },
} as const;

type AuthUiClientPlugins = [
  ReturnType<typeof inferAdditionalFields<never, typeof additionalFields>>,
  ReturnType<typeof adminClient<{}>>,
  ReturnType<typeof anonymousClient>,
  ReturnType<typeof emailOTPClient>,
  ReturnType<typeof lastLoginMethodClient>,
  ReturnType<typeof organizationClient<{ schema: typeof organizationSchema }>>,
  ReturnType<typeof twoFactorClient>,
  ReturnType<typeof apiKeyClient>,
  ReturnType<typeof genericOAuthClient>,
];

const authUiClientPlugins: AuthUiClientPlugins = [
  inferAdditionalFields<never, typeof additionalFields>(additionalFields),
  adminClient(),
  anonymousClient(),
  emailOTPClient(),
  lastLoginMethodClient({
    cookieName: "krakstack-auth.last_used_login_method",
  }),
  organizationClient({ schema: organizationSchema }),
  twoFactorClient(),
  apiKeyClient(),
  genericOAuthClient(),
];

type AuthUiClientOptions = BetterAuthClientOptions & {
  baseURL?: string | undefined;
  plugins: AuthUiClientPlugins;
};

type CreateAuthUiClientOptions = {
  credentials?: RequestCredentials | undefined;
};

export type AuthUiClient = ReactAuthClient<AuthUiClientOptions>;

export const createAuthUiClient = (
  baseUrl?: string | undefined,
  options?: CreateAuthUiClientOptions,
) => {
  const config = {
    fetchOptions: {
      credentials: options?.credentials ?? "include",
    },
    plugins: authUiClientPlugins,
  };
  return createAuthClient<AuthUiClientOptions>(
    baseUrl ? { ...config, baseURL: baseUrl } : config,
  );
};
