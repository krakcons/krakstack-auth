import { apiKeyClient } from "@better-auth/api-key/client";
import { useAtomSuspense } from "@effect/atom-react";
import { useRouterState } from "@tanstack/react-router";
import {
  emailOTPClient,
  genericOAuthClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import type { AuthUiClient } from "./auth-client";
import { authApiClient } from "./auth-api-client";
import type { ExtraProjectPublicConfig } from "../extra/schema";

export type KrakstackAuthLocale = "en" | "fr";

export type KrakstackAuthProviderProps = {
  children: ReactNode;
  locale?: KrakstackAuthLocale | undefined;
  baseUrl?: string | undefined;
  projectId?: string | null | undefined;
  authClient?: AuthUiClient | undefined;
};

export type KrakstackAuthContextValue = {
  locale: KrakstackAuthLocale;
  baseUrl?: string | undefined;
  authClient: AuthUiClient;
  projectConfig: ExtraProjectPublicConfig | null;
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

const getSearchParam = (searchString: string, key: string) => {
  if (!searchString) return null;

  return new URLSearchParams(searchString).get(key);
};

const getBrowserAuthHost = () =>
  typeof window === "undefined" ? null : window.location.host;

const useProjectConfig = (
  baseUrl: string | undefined,
  providedProjectId: string | null | undefined,
) => {
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const projectId =
    providedProjectId ?? getSearchParam(searchString, "projectId");
  const clientId = getSearchParam(searchString, "client_id");
  const host = getBrowserAuthHost();
  const result = useAtomSuspense(
    authApiClient(baseUrl).query("authExtra", "getProjectPublicConfig", {
      query: {
        ...(projectId ? { projectId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(host ? { host } : {}),
      },
      timeToLive: "5 minutes",
      reactivityKeys: [
        "project-public-config",
        ...(projectId ? [`project:${projectId}`] : []),
        ...(clientId ? [`client:${clientId}`] : []),
        ...(host ? [`host:${host}`] : []),
      ],
      serializationKey: `project-public-config:${projectId ?? ""}:${clientId ?? ""}:${host ?? ""}`,
    }),
    { suspendOnWaiting: true },
  );

  return result.value;
};

export function KrakstackAuthProvider({
  children,
  locale = "en",
  baseUrl,
  projectId,
  authClient,
}: KrakstackAuthProviderProps) {
  const resolvedAuthClient = useMemo(
    () => authClient ?? createAuthUiClient(baseUrl),
    [authClient, baseUrl],
  );
  const projectConfig = useProjectConfig(baseUrl, projectId);

  const value = useMemo(
    () => ({ authClient: resolvedAuthClient, baseUrl, locale, projectConfig }),
    [resolvedAuthClient, baseUrl, locale, projectConfig],
  );

  return (
    <KrakstackAuthContext.Provider value={value}>
      {children}
    </KrakstackAuthContext.Provider>
  );
}

export const useKrakstackAuth = () => useContext(KrakstackAuthContext);

export const useKrakstackAuthProjectConfig = () =>
  useKrakstackAuth()?.projectConfig ?? null;
