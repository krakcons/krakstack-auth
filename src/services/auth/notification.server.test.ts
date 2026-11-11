import { describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { vi } from "vitest";

describe("authentication notification transport", () => {
  it.effect("builds the SES dispatcher with legacy sender configuration", () =>
    Effect.gen(function* () {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SES_REGION", "ca-central-1");
      vi.stubEnv("SES_ACCESS_KEY_ID", "test-access-key");
      vi.stubEnv("SES_SECRET_ACCESS_KEY", "test-secret-key");
      vi.stubEnv("NOTIFICATION_EMAIL_FROM", "Legacy <legacy@example.test>");
      yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
      const { notificationLayer } = yield* Effect.promise(
        () => import("./notification.server"),
      );
      yield* Layer.build(notificationLayer);
    }).pipe(Effect.scoped),
  );
});
