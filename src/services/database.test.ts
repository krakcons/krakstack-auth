import { describe, expect, it } from "@effect/vitest";

import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { runWithDatabase, sqlLayer } from "@/services/database";

describe.skipIf(!process.env.TEST_DATABASE_URL)("database runtime", () => {
  it("shares one usable SQL client across imperative calls and separate request scopes", async () => {
    const fromRequest = SqlClient.SqlClient.pipe(Effect.provide(sqlLayer));
    const [imperative, firstRequest] = await Promise.all([
      runWithDatabase(SqlClient.SqlClient),
      Effect.runPromise(fromRequest),
    ]);
    const secondRequest = await Effect.runPromise(fromRequest);

    expect(firstRequest).toBe(imperative);
    expect(secondRequest).toBe(imperative);
    const rows = await runWithDatabase(
      Effect.flatMap(SqlClient.SqlClient, (sql) => sql`SELECT 1 AS value`),
    );
    expect(rows).toEqual([{ value: 1 }]);
  });
});
