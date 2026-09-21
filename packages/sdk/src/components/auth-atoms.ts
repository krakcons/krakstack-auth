import { Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { authClientApi } from "./auth-client-api.js";

const LAST_LOGIN_METHOD_COOKIE = "krakstack-auth.last_used_login_method";
export const AUTH_CLIENT_CHANGE_EVENT = "krakstack-auth:change";

const authRevalidationSignal = Atom.make<Event | null>((get) => {
  if (globalThis.window) {
    const onChange = (event: Event) => get.setSelf(event);
    window.addEventListener(AUTH_CLIENT_CHANGE_EVENT, onChange);
    get.addFinalizer(() =>
      window.removeEventListener(AUTH_CLIENT_CHANGE_EVENT, onChange),
    );
  }
  return null;
});

// Each registry subscribes once; query refreshes stay inside the atom graph.
const refreshOnAuthSignal = Atom.makeRefreshOnSignal(authRevalidationSignal);

export const refreshOnAuthChange = <A>(atom: Atom.Atom<A>): Atom.Atom<A> => {
  const reactive = refreshOnAuthSignal(atom);
  // The built-in visibility helper is browser-only.
  return globalThis.window ? Atom.refreshOnWindowFocus(reactive) : reactive;
};

export const authSessionAtom = Atom.family((baseUrl?: string) =>
  Atom.optimistic(
    authClientApi(baseUrl)
      .query("auth", "getSession", {
        query: {},
        timeToLive: "1 minute",
        reactivityKeys: ["auth-session"],
      })
      .pipe(
        Atom.map((result) => {
          const unauthorized = AsyncResult.error(result).pipe(
            Option.exists((error) => error._tag === "AuthUnauthorized"),
          );
          return unauthorized && !result.waiting
            ? AsyncResult.success(null)
            : result;
        }),
      ),
  ).pipe(refreshOnAuthChange),
);

export const authOrganizationsAtom = Atom.family((baseUrl?: string) =>
  Atom.optimistic(
    authClientApi(baseUrl).query("auth", "organizationList", {
      timeToLive: "1 minute",
      reactivityKeys: ["auth-organizations"],
    }),
  ).pipe(refreshOnAuthChange),
);

export const activeAuthOrganizationAtom = Atom.family((baseUrl?: string) =>
  Atom.family((organizationId: string | null) =>
    Atom.optimistic(
      authClientApi(baseUrl).query("auth", "organizationGetFull", {
        query: organizationId ? { organizationId } : {},
        timeToLive: "1 minute",
        reactivityKeys: ["auth-active-organization", organizationId ?? "none"],
      }),
    ).pipe(refreshOnAuthChange),
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
};
