import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";

import { authSessionAtom, refreshAuthSession } from "./auth-atoms.js";

it.effect("waits for the signed-in session before continuing navigation", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<Response>();
    let signedIn = false;
    let navigated = false;
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
        name: "Login",
        email: "login@example.test",
        emailVerified: true,
        image: null,
        role: null,
        banned: false,
        createdAt: now,
        updatedAt: now,
      },
    };
    const capture: typeof fetch = async () => {
      if (!signedIn) return Response.json(null);
      started.resolve();
      return (await response.promise).clone();
    };
    vi.stubGlobal("fetch", capture);
    try {
      const baseUrl = "https://login-refresh.example.test";
      const session = authSessionAtom(baseUrl);
      registry.mount(session);
      expect(yield* AtomRegistry.getResult(registry, session)).toBeNull();
      signedIn = true;
      const completion = Effect.runPromise(
        refreshAuthSession(registry, baseUrl).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              navigated = true;
            }),
          ),
        ),
      );
      yield* Effect.promise(() => started.promise);
      expect(navigated).toBe(false);
      // The retained view still looks settled while its query is refreshing.
      expect(
        yield* AtomRegistry.getResult(registry, session, {
          suspendOnWaiting: true,
        }),
      ).toBeNull();
      response.resolve(Response.json(sessionResponse));
      yield* Effect.promise(() => completion);
      expect(navigated).toBe(true);
      expect((yield* AtomRegistry.getResult(registry, session))?.user.id).toBe(
        "user",
      );
    } finally {
      registry.dispose();
      vi.unstubAllGlobals();
    }
  }),
);
