import { Effect, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import { authClientApi, authHttpClient } from "./auth-client-api.js";
import type { UserLocale } from "../schema.js";

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

const authSessionQueryAtom = Atom.family((baseUrl?: string) =>
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
    )
    .pipe(refreshOnAuthChange),
);

export const authSessionAtom = Atom.family((baseUrl?: string) =>
  Atom.optimistic(authSessionQueryAtom(baseUrl)),
);

export const refreshAuthSession = Effect.fn("refreshAuthSession")(function* (
  registry: AtomRegistry.AtomRegistry,
  baseUrl?: string,
) {
  const query = authSessionQueryAtom(baseUrl);
  notifyAuthChange();
  registry.refresh(query);
  // Wait on the authoritative query, not its optimistic view, which retains
  // the previous success without a waiting flag during revalidation.
  return yield* AtomRegistry.getResult(registry, query, {
    suspendOnWaiting: true,
  });
});

export const updateUserLocaleAtom = Atom.family((baseUrl?: string) =>
  Atom.optimisticFn(authSessionAtom(baseUrl), {
    reducer: (state, locale: typeof UserLocale.Type) =>
      AsyncResult.map(state, (session) =>
        session ? { ...session, user: { ...session.user, locale } } : session,
      ),
    fn: authClientApi(baseUrl).runtime.fn((locale: typeof UserLocale.Type) =>
      Effect.gen(function* () {
        const client = yield* authHttpClient(baseUrl);
        yield* client.auth.updateUser({ payload: { locale } });
        notifyAuthChange();
      }),
    ),
  }),
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

// Changing identity must discard the host application's router and query caches.
// Do not notify mounted guards first: they still belong to the previous user.
export const reloadAfterImpersonation = () => {
  window.location.reload();
};
