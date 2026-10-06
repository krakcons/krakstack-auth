import { PgMigrator } from "@effect/sql-pg";
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { createHash } from "node:crypto";
import { baselineFingerprints } from "./baseline";
import { applicationTables, schemaDefinitions } from "./migration-schema";

const NativeMigration = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
}).annotate({ identifier: "AdoptionNativeMigration" });

export const verifyBaseline = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`SET LOCAL search_path TO public`;
  const actual = new Map(
    (yield* schemaDefinitions()).map(({ name, definition }) => [
      name,
      createHash("sha256").update(definition).digest("hex"),
    ]),
  );
  const differences = [...baselineFingerprints]
    .filter(([name, fingerprint]) => actual.get(name) !== fingerprint)
    .map(([name]) => name);
  if (differences.length)
    return yield* new PgMigrator.MigrationError({
      kind: "BadState",
      message: `Baseline schema differs in: ${differences.join(", ")}. Adoption refused; reconcile the schema separately.`,
    });
});

export const adopt = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(478341934)`;
      // Report missing tables before acquiring locks; recheck under the locks.
      yield* verifyBaseline;
      yield* sql`LOCK TABLE ${sql.literal(applicationTables.map((name) => `public."${name}"`).join(", "))} IN SHARE MODE`;
      yield* verifyBaseline;
      yield* sql`CREATE TABLE IF NOT EXISTS public.effect_sql_migrations (
      migration_id integer PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL
    )`;
      yield* sql`LOCK TABLE public.effect_sql_migrations IN ACCESS EXCLUSIVE MODE`;
      const native = yield* SqlSchema.findAll({
        Request: Schema.Void,
        Result: NativeMigration,
        execute: () =>
          sql`SELECT migration_id AS id, name FROM public.effect_sql_migrations ORDER BY migration_id`,
      })();
      if (native.length) {
        if (
          native.length === 1 &&
          native[0]?.id === 1 &&
          native[0]?.name === "legacy"
        )
          return false;
        return yield* new PgMigrator.MigrationError({
          kind: "BadState",
          message: "Unexpected native migration history; adoption refused.",
        });
      }
      yield* sql`INSERT INTO public.effect_sql_migrations (migration_id, name) VALUES (1, 'legacy')`;
      return true;
    }),
  );
});
