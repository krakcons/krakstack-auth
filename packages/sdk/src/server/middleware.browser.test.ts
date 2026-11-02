import { describe, expect, it } from "@effect/vitest";
import { build } from "bun";

describe("Auth middleware browser boundary", () => {
  it("imports API middleware contracts without loading the webhook receiver or Postgres", async () => {
    const result = await build({
      entrypoints: [new URL("./middleware.ts", import.meta.url).pathname],
      target: "browser",
      plugins: [
        {
          name: "enforce-server-boundary",
          setup: (build) => {
            build.onResolve(
              { filter: /webhook-layer\.js$/ },
              ({ path, kind }) => {
                if (kind !== "dynamic-import")
                  throw new Error(
                    "Webhook implementation must be loaded lazily",
                  );
                return { path, external: true };
              },
            );
            build.onResolve(
              {
                filter:
                  /^(?:node:|bun:|@effect\/sql-|pg$|@krak-stack\/registry\/webhooks$)/,
              },
              ({ path }) => {
                throw new Error(
                  `Server dependency eagerly imported by an API contract: ${path}`,
                );
              },
            );
          },
        },
      ],
    });
    expect(result.logs).toEqual([]);
    expect(result.success).toBe(true);
  });
});
