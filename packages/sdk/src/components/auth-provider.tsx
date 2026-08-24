import { useAtomSuspense } from "@effect/atom-react";
import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { createAuthUiClient, type AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
import type { ExtraProjectPublicConfig } from "../extra/schema";
import type {
  ProjectAccessCatalog,
  ProjectAccessLabelCatalog,
} from "../access";
import { parseRoleList } from "../roles";

export type KrakstackAuthLocale = "en" | "fr";

export type KrakstackAuthProviderProps = {
  children: ReactNode;
  locale?: KrakstackAuthLocale | undefined;
  baseUrl?: string | undefined;
  projectId?: string | null | undefined;
  authClient?: AuthUiClient | undefined;
  access?: ProjectAccessCatalog | undefined;
  accessLabels?: ProjectAccessLabelCatalog | undefined;
};

export type KrakstackAuthContextValue = {
  locale: KrakstackAuthLocale;
  baseUrl?: string | undefined;
  projectId?: string | null | undefined;
  authClient: AuthUiClient;
  projectConfig: ExtraProjectPublicConfig | null;
  access: ProjectAccessCatalog | null;
  accessLabels: ProjectAccessLabelCatalog | null;
  authRefreshVersion: number;
  refreshAuth: () => void;
};

const KrakstackAuthContext = createContext<KrakstackAuthContextValue | null>(
  null,
);

const PROJECT_CONTEXT_COOKIE = "krakstack-auth.project_context";
export const listenForSessionRevalidation = (
  target: EventTarget,
  revalidate: () => void,
) => {
  const onPageShow = (event: Event) => {
    if ("persisted" in event && event.persisted === true) revalidate();
  };

  target.addEventListener("pageshow", onPageShow);

  return () => {
    target.removeEventListener("pageshow", onPageShow);
  };
};

const setProjectContextCookie = (projectId: string | null | undefined) => {
  if (!globalThis.document) return;

  const secure =
    globalThis.window.location.protocol === "https:" ? "; Secure" : "";
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

const getBrowserAuthHost = () => globalThis.window?.location.host ?? null;

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

interface ProjectConfigQuery {
  projectId?: string;
  clientId?: string;
  host?: string;
  rootHost?: string;
}

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
  const query: ProjectConfigQuery = {};
  if (projectId) query.projectId = projectId;
  if (clientId) query.clientId = clientId;
  if (host) query.host = host;
  if (rootHost) query.rootHost = rootHost;
  const result = useAtomSuspense(
    authClientApi(baseUrl).query("authExtra", "getProjectPublicConfig", {
      query,
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
  access,
  accessLabels,
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
  const [authRefreshVersion, setAuthRefreshVersion] = useState(0);
  const refreshAuth = useCallback(() => {
    setAuthRefreshVersion((current) => current + 1);
  }, []);
  const session = resolvedAuthClient.useSession();
  const revalidateSession = useEffectEvent(async () => {
    await session.refetch();
    refreshAuth();
  });

  useEffect(() => {
    setProjectContextCookie(resolvedProjectId);
  }, [resolvedProjectId]);

  useEffect(
    () =>
      listenForSessionRevalidation(window, () => {
        void revalidateSession();
      }),
    [],
  );

  const value = useMemo(
    () => ({
      authClient: resolvedAuthClient,
      baseUrl,
      locale,
      projectId: resolvedProjectId,
      projectConfig,
      access: access ?? null,
      accessLabels: accessLabels ?? null,
      authRefreshVersion,
      refreshAuth,
    }),
    [
      resolvedAuthClient,
      baseUrl,
      locale,
      resolvedProjectId,
      projectConfig,
      access,
      accessLabels,
      authRefreshVersion,
      refreshAuth,
    ],
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

export const usePermissions = () => {
  const auth = useKrakstackAuth();
  if (!auth) {
    throw new Error("KrakstackAuthProvider is required to use permissions.");
  }

  const session = auth.authClient.useSession();
  const activeOrganization = auth.authClient.useActiveOrganization();
  const memberRole = activeOrganization.data?.members.find(
    (member) => member.userId === session.data?.user.id,
  )?.role;
  const actions = new Set<string>();

  if (auth.access) {
    for (const role of parseRoleList(memberRole)) {
      for (const action of auth.access.roles[role] ?? []) actions.add(action);
    }
  }

  return {
    loading: session.isPending || activeOrganization.isPending,
    permissions: auth.access
      ? new Set(
          Array.from(actions, (action) => `${auth.access?.project}:${action}`),
        )
      : new Set<string>(),
    can: (action: string) => actions.has(action),
    canAll: (required: ReadonlyArray<string>) =>
      required.every((action) => actions.has(action)),
    canAny: (required: ReadonlyArray<string>) =>
      required.some((action) => actions.has(action)),
  };
};
