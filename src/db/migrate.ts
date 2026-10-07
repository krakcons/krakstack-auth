import * as BunServices from "@effect/platform-bun/BunServices";
import { PgMigrator } from "@effect/sql-pg";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

import initialMigration from "./migrations/0001_initial";

// Keep the already-persisted ID/name; replacing the implementation must not
// rewrite an existing Effect ledger or reapply migration 1.
export const migrationLoader = PgMigrator.fromRecord({
  "1_legacy": initialMigration,
});

export const migrate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(478341934)`;
      yield* sql`SET LOCAL search_path TO public`;
      // Create transactionally before PgMigrator's regclass probe, serializing
      // first startup and adoption, including when the ledger does not exist yet.
      yield* sql`CREATE TABLE IF NOT EXISTS public.effect_sql_migrations (
      migration_id integer PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL
    )`;
      return yield* PgMigrator.run({ loader: migrationLoader });
    }),
  );
}).pipe(Effect.provide(BunServices.layer));
