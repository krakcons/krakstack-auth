import { apiKeyClient } from "@better-auth/api-key/client";
import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

type Session = {
  session: {
    activeOrganizationId?: string | null | undefined;
    impersonatedBy?: string | null | undefined;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null | undefined;
    role?: string | null | undefined;
  };
};

type Query<T> = {
  data: T | null | undefined;
  isPending: boolean;
  refetch: () => Promise<unknown>;
};

type BaseAuthUiClient = ReturnType<
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

export type AuthUiClient = Omit<
  BaseAuthUiClient,
  | "getSession"
  | "organization"
  | "useSession"
  | "useActiveOrganization"
  | "useActiveMemberRole"
> & {
  getSession: () => Promise<{ data: Session | null; error: unknown }>;
  organization: {
    setActive: (input: { organizationId: string }) => Promise<{
      data: unknown;
      error: unknown;
    }>;
  };
  useSession: () => Query<Session>;
  useActiveOrganization: () => Query<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date | string;
    members: unknown[];
    invitations: unknown[];
  }>;
  useActiveMemberRole: () => Query<{ role: string }>;
};

export const createAuthUiClient = (
  baseUrl?: string | undefined,
): AuthUiClient =>
  createAuthClient({
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    plugins: [
      adminClient(),
      emailOTPClient(),
      lastLoginMethodClient({
        cookieName: "krakstack-auth.last_used_login_method",
      }),
      organizationClient(),
      twoFactorClient(),
      apiKeyClient(),
      genericOAuthClient(),
    ],
  });
