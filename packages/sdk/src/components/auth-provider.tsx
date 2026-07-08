import { useAtomSuspense } from "@effect/atom-react";
import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { createAuthUiClient, type AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
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
  projectId?: string | null | undefined;
  authClient: AuthUiClient;
  projectConfig: ExtraProjectPublicConfig | null;
};

const KrakstackAuthContext = createContext<KrakstackAuthContextValue | null>(
  null,
);

const PROJECT_CONTEXT_COOKIE = "krakstack-auth.project_context";

const setProjectContextCookie = (projectId: string | null | undefined) => {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (!projectId) {
    document.cookie = `${PROJECT_CONTEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }

  document.cookie = `${PROJECT_CONTEXT_COOKIE}=${encodeURIComponent(projectId)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
};

const getSearchParam = (searchString: string, key: string) => {
  if (!searchString) return null;

  return new URLSearchParams(searchString).get(key);
};

const getBrowserAuthHost = () =>
  typeof window === "undefined" ? null : window.location.host;

const getRedirectHost = (searchString: string) => {
  if (!searchString) return null;

  const search = new URLSearchParams(searchString);
  const target =
    search.get("callbackURL") ??
    search.get("redirect") ??
    search.get("redirectTo") ??
    search.get("returnTo") ??
    search.get("redirect_uri");
  if (!target) return null;

  try {
    return new URL(target).host;
  } catch {
    return null;
  }
};

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
  const rootHost = getRedirectHost(searchString);
  const result = useAtomSuspense(
    authClientApi(baseUrl).query("authExtra", "getProjectPublicConfig", {
      query: {
        ...(projectId ? { projectId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(host ? { host } : {}),
        ...(rootHost ? { rootHost } : {}),
      },
      timeToLive: "5 minutes",
      reactivityKeys: [
        "project-public-config",
        ...(projectId ? [`project:${projectId}`] : []),
        ...(clientId ? [`client:${clientId}`] : []),
        ...(host ? [`host:${host}`] : []),
        ...(rootHost ? [`root-host:${rootHost}`] : []),
      ],
      serializationKey: `project-public-config:${projectId ?? ""}:${clientId ?? ""}:${host ?? ""}:${rootHost ?? ""}`,
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
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const resolvedProjectId =
    projectId ?? getSearchParam(searchString, "projectId");
  const resolvedAuthClient = useMemo(
    () => authClient ?? createAuthUiClient(baseUrl),
    [authClient, baseUrl],
  );
  const projectConfig = useProjectConfig(baseUrl, projectId);

  useEffect(() => {
    setProjectContextCookie(resolvedProjectId);
  }, [resolvedProjectId]);

  const value = useMemo(
    () => ({
      authClient: resolvedAuthClient,
      baseUrl,
      locale,
      projectId: resolvedProjectId,
      projectConfig,
    }),
    [resolvedAuthClient, baseUrl, locale, resolvedProjectId, projectConfig],
  );

  return (
    <KrakstackAuthContext.Provider value={value}>
      {children}
    </KrakstackAuthContext.Provider>
  );
}

export const useKrakstackAuth = () => useContext(KrakstackAuthContext);

export const useAuthClient = (): AuthUiClient => {
  const auth = useKrakstackAuth();

  if (!auth?.authClient) {
    throw new Error("KrakstackAuthProvider is required to use authClient.");
  }

  return auth.authClient;
};

export const useKrakstackAuthProjectConfig = () =>
  useKrakstackAuth()?.projectConfig ?? null;
