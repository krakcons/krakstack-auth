import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";

import {
  AUTH_CLIENT_CHANGE_EVENT,
  notifyAuthChange,
  refreshOnAuthChange,
  reloadAfterImpersonation,
  authSessionAtom,
  updateUserLocaleAtom,
} from "./auth-atoms.js";

describe("auth atom revalidation", () => {
  it.effect(
    "shares optimistic language changes with session readers and rolls back failed saves",
    () =>
      Effect.gen(function* () {
        const registry = AtomRegistry.make();
        const started = Promise.withResolvers<void>();
        const response = Promise.withResolvers<Response>();
        const now = new Date().toISOString();
        const sessionResponse = {
          session: {
            id: "session",
            userId: "user",
            token: "token",
            expiresAt: now,
            createdAt: now,
            updatedAt: now,
          },
          user: {
            id: "user",
            name: "Locale",
            email: "locale@example.test",
            emailVerified: true,
            image: null,
            role: null,
            banned: false,
            locale: "en",
            createdAt: now,
            updatedAt: now,
          },
        };
        const capture: typeof fetch = async (input, init) => {
          const request = new Request(input, init);
          if (new URL(request.url).pathname.endsWith("/update-user")) {
            expect(await request.json()).toEqual({ locale: "fr" });
            started.resolve();
            return response.promise;
          }
          return Response.json(sessionResponse);
        };
        vi.stubGlobal("fetch", capture);
        try {
          const baseUrl = "https://locale-rollback.example.test";
          const session = authSessionAtom(baseUrl);
          const update = updateUserLocaleAtom(baseUrl);
          registry.mount(session);
          yield* AtomRegistry.getResult(registry, session);
          registry.set(update, "fr");
          yield* Effect.promise(() => started.promise);
          expect(
            AsyncResult.getOrElse(registry.get(session), () => null)?.user
              .locale,
          ).toBe("fr");
          response.resolve(
            Response.json(
              { code: "BAD_REQUEST", message: "Save failed" },
              { status: 400 },
            ),
          );
          expect(
            (yield* AtomRegistry.getResult(registry, update).pipe(Effect.exit))
              ._tag,
          ).toBe("Failure");
          expect(
            AsyncResult.getOrElse(registry.get(session), () => null)?.user
              .locale,
          ).toBe("en");
        } finally {
          registry.dispose();
          vi.unstubAllGlobals();
        }
      }),
  );
  it("reloads after impersonation without refreshing the previous user's guards", () => {
    const reload = vi.fn();
    const window = Object.assign(new EventTarget(), { location: { reload } });
    const onAuthChange = vi.fn();
    window.addEventListener(AUTH_CLIENT_CHANGE_EVENT, onAuthChange);
    vi.stubGlobal("window", window);
    try {
      reloadAfterImpersonation();

      expect(reload).toHaveBeenCalledExactlyOnceWith();
      expect(onAuthChange).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refreshes mounted queries across registries and releases listeners", () => {
    const document = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    const window = Object.assign(new EventTarget(), { document });
    vi.stubGlobal("window", window);
    vi.stubGlobal("document", document);
    const removeListener = vi.spyOn(window, "removeEventListener");
    const addListener = vi.spyOn(window, "addEventListener");
    const root = AtomRegistry.make();
    const nested = AtomRegistry.make();
    let reads = 0;
    const session = Atom.make(() => ++reads).pipe(refreshOnAuthChange);
    const organization = Atom.make(() => ++reads).pipe(refreshOnAuthChange);
    try {
      root.mount(session);
      nested.mount(session);
      nested.mount(organization);
      const readAll = () => [
        root.get(session),
        nested.get(session),
        nested.get(organization),
      ];
      const initial = readAll();
      expect(
        addListener.mock.calls.filter(([name]) => name === "visibilitychange"),
      ).toHaveLength(2);

      window.dispatchEvent(new Event("visibilitychange"));
      const focused = readAll();
      focused.forEach((value, index) =>
        expect(value).toBeGreaterThan(initial[index]!),
      );

      notifyAuthChange();
      const changed = readAll();
      changed.forEach((value, index) =>
        expect(value).toBeGreaterThan(focused[index]!),
      );

      document.visibilityState = "hidden";
      window.dispatchEvent(new Event("visibilitychange"));
      expect(readAll()).toEqual(changed);
      window.dispatchEvent(new Event("pageshow"));
      expect(readAll()).toEqual(changed);

      document.visibilityState = "visible";
      window.dispatchEvent(new Event("visibilitychange"));
      const visible = readAll();
      visible.forEach((value, index) =>
        expect(value).toBeGreaterThan(changed[index]!),
      );

      root.dispose();
      nested.dispose();
      expect(
        removeListener.mock.calls.filter(
          ([name]) => name === "visibilitychange",
        ),
      ).toHaveLength(2);
      const previousReads = reads;
      window.dispatchEvent(new Event("visibilitychange"));
      expect(reads).toBe(previousReads);
    } finally {
      root.dispose();
      nested.dispose();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("can read auth queries during SSR without browser globals", () => {
    const registry = AtomRegistry.make();
    try {
      expect(
        registry.get(Atom.make(() => "session").pipe(refreshOnAuthChange)),
      ).toBe("session");
    } finally {
      registry.dispose();
    }
  });
});
