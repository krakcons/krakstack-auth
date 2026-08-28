import { Atom } from "effect/unstable/reactivity";

import { authClientApi } from "./auth-client-api.js";

const LAST_LOGIN_METHOD_COOKIE = "krakstack-auth.last_used_login_method";
export const AUTH_CLIENT_CHANGE_EVENT = "krakstack-auth:change";
const AUTH_CLIENT_CHANGE_STORAGE_KEY = "krakstack-auth.change";

export const authSessionAtom = Atom.family((baseUrl?: string) =>
  Atom.optimistic(
    authClientApi(baseUrl).query("auth", "getSession", {
      query: {},
      timeToLive: "1 minute",
      reactivityKeys: ["auth-session"],
    }),
  ),
);

export const authOrganizationsAtom = Atom.family((baseUrl?: string) =>
  Atom.optimistic(
    authClientApi(baseUrl).query("auth", "organizationList", {
      timeToLive: "1 minute",
      reactivityKeys: ["auth-organizations"],
    }),
  ),
);

export const activeAuthOrganizationAtom = Atom.family((baseUrl?: string) =>
  Atom.family((organizationId: string | null) =>
    Atom.optimistic(
      authClientApi(baseUrl).query("auth", "organizationGetFull", {
        query: organizationId ? { organizationId } : {},
        timeToLive: "1 minute",
        reactivityKeys: ["auth-active-organization", organizationId ?? "none"],
      }),
    ),
  ),
);

export const getLastUsedLoginMethod = () => {
  const cookies = globalThis.document?.cookie;
  if (!cookies) return null;

  for (const cookie of cookies.split(";")) {
    const [name, ...parts] = cookie.trim().split("=");
    if (name !== LAST_LOGIN_METHOD_COOKIE) continue;
    try {
      return decodeURIComponent(parts.join("=")) || null;
    } catch {
      return parts.join("=") || null;
    }
  }
  return null;
};

export const notifyAuthChange = () => {
  globalThis.window?.dispatchEvent(new Event(AUTH_CLIENT_CHANGE_EVENT));
  try {
    globalThis.localStorage?.setItem(
      AUTH_CLIENT_CHANGE_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
};

export const isAuthClientStorageEvent = (event: StorageEvent) =>
  event.key === AUTH_CLIENT_CHANGE_STORAGE_KEY;
