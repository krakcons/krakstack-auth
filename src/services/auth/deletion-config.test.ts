import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";
import { createAuth } from "./config";

describe("production deletion configuration", () => {
  it("disables native self-deletion and blocks admin removal before scheduling cleanup", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const deletionRun = vi.fn(async () => {});
      const auth = createAuth({
        allowedHosts: ["auth.example.test"],
        deletionRun,
      });
      expect(auth.options.user.deleteUser.enabled).toBe(false);
      expect(() =>
        auth.options.databaseHooks.user.delete.before({
          id: "user",
          name: "Test",
          email: "user@example.test",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow("Account and organization deletion is disabled");
      expect(deletionRun).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
