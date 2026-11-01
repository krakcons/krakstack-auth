import { describe, expect, it } from "@effect/vitest";

describe("Account deletion browser boundary", () => {
  it("bundles shared contracts without database drivers or server-only webhook code", async () => {
    const result = await Bun.build({
      entrypoints: [new URL("./schema.ts", import.meta.url).pathname],
      target: "browser",
      plugins: [{
        name: "reject-server-dependencies",
        setup: (build) => {
          build.onResolve({ filter: /^(?:node:|bun:|@effect\/sql-|pg$|@krak-stack\/registry\/webhooks(?:$|\/))/ }, ({ path }) => {
            throw new Error(`Server dependency in a browser contract: ${path}`);
          });
        },
      }],
    });
    expect(result.logs).toEqual([]);
    expect(result.success).toBe(true);
  });
});
