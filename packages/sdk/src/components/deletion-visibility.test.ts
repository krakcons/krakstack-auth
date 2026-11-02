import { afterEach, describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Deletion controls rollout", () => {
  it.each([true, false])(
    "enables controls only when DEV is %s",
    async (development) => {
      vi.stubEnv("DEV", development);
      vi.resetModules();
      const { deletionControlsEnabled } =
        await import("./deletion-visibility.js");
      expect(deletionControlsEnabled).toBe(development);
    },
  );
});
