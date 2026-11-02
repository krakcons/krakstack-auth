import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";
import { assertDeletionEnabled, deletionEnabled } from "./deletion";

describe("server deletion policy", () => {
  it.each(["production", "staging", "", "unexpected"])(
    "disables deletion in %s",
    (environment) => {
      expect(deletionEnabled(environment)).toBe(false);
    },
  );

  it.each(["development", "test"])("allows deletion in %s", (environment) => {
    expect(deletionEnabled(environment)).toBe(true);
  });

  it("rejects production and missing runtime configuration", () => {
    try {
      for (const environment of ["production", undefined]) {
        vi.stubEnv("NODE_ENV", environment);
        expect(() => assertDeletionEnabled()).toThrow(
          "Account and organization deletion is disabled",
        );
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
