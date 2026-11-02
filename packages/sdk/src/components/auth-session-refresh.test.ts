import { expect, it } from "@effect/vitest";
import { mockFetch } from "../../test/fetch.js";
import { Effect, Fiber } from "effect";
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
    const capture: typeof fetch = mockFetch(async () => {
      if (!signedIn) return Response.json(null);
      started.resolve();
      return (await response.promise).clone();
    });
    vi.stubGlobal("fetch", capture);
    try {
      const baseUrl = "https://login-refresh.example.test";
      const session = authSessionAtom(baseUrl);
      registry.mount(session);
      expect(yield* AtomRegistry.getResult(registry, session)).toBeNull();
      signedIn = true;
      const completion = yield* refreshAuthSession(registry, baseUrl).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            navigated = true;
          }),
        ),
        Effect.forkChild,
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
      yield* Fiber.join(completion);
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
