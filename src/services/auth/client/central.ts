import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/react";
import {
  anonymousClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

const organizationSchema = {
  organization: {
    additionalFields: {
      userId: { type: "string", required: false },
      parentId: { type: "string", required: false },
    },
  },
} as const;

export const centralAuthClient = createAuthClient({
  baseURL: import.meta.env.VITE_KRAKSTACK_AUTH_URL,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    anonymousClient(),
    twoFactorClient({
      twoFactorPage: `${import.meta.env.VITE_KRAKSTACK_AUTH_URL}/2fa`,
    }),
    organizationClient({ schema: organizationSchema }),
    apiKeyClient(),
  ],
});
