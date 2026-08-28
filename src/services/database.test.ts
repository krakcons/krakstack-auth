import { describe, expect, it } from "@effect/vitest";

import { DB, runWithDatabase } from "@/services/database";

describe("database runtime", () => {
  it("reuses the database service across imperative calls", async () => {
    const first = await runWithDatabase(DB);
    const second = await runWithDatabase(DB);

    expect(first).toBe(second);
  });
});
