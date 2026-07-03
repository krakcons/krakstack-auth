import { apiKeyClient } from "@better-auth/api-key/client";
import {
  emailOTPClient,
  genericOAuthClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import type { AuthUiClient } from "./auth-client";

export type KrakstackAuthLocale = "en" | "fr";

export type KrakstackAuthProviderProps = {
  children: ReactNode;
  locale?: KrakstackAuthLocale | undefined;
  baseUrl?: string | undefined;
  authClient?: AuthUiClient | undefined;
};

export type KrakstackAuthContextValue = {
  locale: KrakstackAuthLocale;
  baseUrl?: string | undefined;
  authClient: AuthUiClient;
};

const KrakstackAuthContext = createContext<KrakstackAuthContextValue | null>(
  null,
);

const createAuthUiClient = (baseUrl?: string | undefined): AuthUiClient =>
  createAuthClient({
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    plugins: [
      emailOTPClient(),
      organizationClient(),
      twoFactorClient(),
      apiKeyClient(),
      genericOAuthClient(),
    ],
  });

export function KrakstackAuthProvider({
  children,
  locale = "en",
  baseUrl,
  authClient,
}: KrakstackAuthProviderProps) {
  const resolvedAuthClient = useMemo(
    () => authClient ?? createAuthUiClient(baseUrl),
    [authClient, baseUrl],
  );

  const value = useMemo(
    () => ({ authClient: resolvedAuthClient, baseUrl, locale }),
    [resolvedAuthClient, baseUrl, locale],
  );

  return (
    <KrakstackAuthContext.Provider value={value}>
      {children}
    </KrakstackAuthContext.Provider>
  );
}

export const useKrakstackAuth = () => useContext(KrakstackAuthContext);
