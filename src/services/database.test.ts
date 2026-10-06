import { describe, expect, it } from "@effect/vitest";

import { SqlClient } from "effect/unstable/sql";
import { runWithDatabase } from "@/services/database";

describe("database runtime", () => {
  it("reuses the database service across imperative calls", async () => {
    const first = await runWithDatabase(SqlClient.SqlClient);
    const second = await runWithDatabase(SqlClient.SqlClient);

    expect(first).toBe(second);
  });
});
