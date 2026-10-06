import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { sqlTestLayer } from "@/services/database";
import { migrate } from "./migrate";
import {
  legacyMigrationNames,
  legacyMigrationTimestamp,
} from "./migrations/0001_legacy";

describe("legacy migration ordering", () => {
  it("keeps all historical migrations in timestamp order", () => {
    const timestamps = legacyMigrationNames.map(legacyMigrationTimestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    expect(new Set(timestamps).size).toBe(17);
    expect(timestamps[0]).toBe(Date.UTC(2026, 4, 14, 23, 38, 18));
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("Effect SQL migrations", () => {
  it.effect(
    "records the legacy bridge and does not replay applied migrations",
    () =>
      Effect.gen(function* () {
        yield* migrate;
        expect(yield* migrate).toEqual([]);
        const sql = yield* SqlClient.SqlClient;
        const records = yield* SqlSchema.findAll({
          Request: Schema.Void,
          Result: Schema.Struct({
            migrationId: Schema.Number,
            name: Schema.String,
          }).annotate({ identifier: "MigrationRecord" }),
          execute: () =>
            sql`SELECT migration_id, name FROM effect_sql_migrations ORDER BY migration_id`,
        })(undefined);
        expect(records).toContainEqual({ migrationId: 1, name: "legacy" });
      }).pipe(Effect.provide(sqlTestLayer)),
  );
});
