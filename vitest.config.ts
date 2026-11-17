import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Transform the SSO package so its dynamic DNS import can use test mocks.
    server: { deps: { inline: ["@better-auth/sso"] } },
    include: ["src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
  },
});
