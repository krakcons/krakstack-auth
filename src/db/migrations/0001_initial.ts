import * as BunServices from "@effect/platform-bun/BunServices";
import { PgMigrator } from "@effect/sql-pg";
import { Effect, FileSystem, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { fileURLToPath } from "node:url";
import { applicationTables } from "../migration-schema";

const ExistingTable = Schema.Struct({ name: Schema.String }).annotate({
  identifier: "ExistingApplicationTable",
});

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const fs = yield* FileSystem.FileSystem;
  const existing = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: ExistingTable,
    execute:
      () => sql`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND ${sql.in("c.relname", applicationTables)}`,
  })();
  if (existing.length)
    return yield* new PgMigrator.MigrationError({
      kind: "BadState",
      message:
        "Existing application schema requires verified adoption: run bun run db:adopt (or db:adopt:test).",
    });
  yield* sql`SET LOCAL search_path TO public`;
  const content = yield* fs.readFileString(
    fileURLToPath(new URL("./0001_initial.sql", import.meta.url)),
  );
  // This fixed baseline contains only semicolon-delimited DDL (no procedural
  // bodies or semicolons in literals). The native driver executes one statement
  // per query. Preserve the SQL and persisted migration ID/name unchanged.
  for (const statement of content
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((value) => value.trim())) {
    if (statement) yield* sql.unsafe(statement);
  }
}).pipe(Effect.provide(BunServices.layer));
