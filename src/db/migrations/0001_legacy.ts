import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

export const legacyMigrationNames = [
  "20260514233818_massive_squirrel_girl",
  "20260526200000_update_api_key_rate_limit_default",
  "20260616000000_split_projects_from_oauth_clients",
  "20260623213726_easy_luke_cage",
  "20260623230000_remove_project_slug",
  "20260624170000_add_domain_managed",
  "20260705120000_allow_duplicate_auth_hostnames",
  "20260705180650_groovy_surge",
  "20260707140514_violet_namora",
  "20260707165814_modern_chamber",
  "20260708161139_tearful_norrin_radd",
  "20260716155217_anonymous-users",
  "20260722193805_personal_organizations",
  "20260728190531_organization_parents",
  "20260826184917_user-contact-metadata",
  "20260828155414_chubby_princess_powerful",
  "20260925150421_jittery_beast",
] as const;

export const legacyMigrationTimestamp = (name: string) =>
  Date.UTC(
    Number(name.slice(0, 4)),
    Number(name.slice(4, 6)) - 1,
    Number(name.slice(6, 8)),
    Number(name.slice(8, 10)),
    Number(name.slice(10, 12)),
    Number(name.slice(12, 14)),
  );

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const fs = yield* FileSystem.FileSystem;
  const legacy = yield* SqlSchema.findOne({
    Request: Schema.Void,
    Result: Schema.Struct({ exists: Schema.Boolean }).annotate({
      identifier: "LegacyMigrationTable",
    }),
    execute: () =>
      sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`,
  })(undefined);
  const latest = legacy.exists
    ? yield* SqlSchema.findOne({
        Request: Schema.Void,
        Result: Schema.Struct({ timestamp: Schema.NumberFromString }).annotate({
          identifier: "LegacyMigrationTimestamp",
        }),
        execute: () =>
          sql`SELECT coalesce(max(created_at), 0)::text AS timestamp FROM drizzle.__drizzle_migrations`,
      })(undefined)
    : { timestamp: 0 };

  // Keep the historical SQL untouched. Match the legacy timestamp-based ordering
  // for existing installations; apply all historical migrations on fresh ones.
  for (const name of legacyMigrationNames) {
    if (legacyMigrationTimestamp(name) <= latest.timestamp) continue;
    const source = yield* fs.readFileString(
      `src/db/migrations/legacy/${name}.sql`,
    );
    for (const statement of source.split("--> statement-breakpoint")) {
      if (statement.trim()) yield* sql.unsafe(statement);
    }
  }
}).pipe(Effect.provide(BunServices.layer));
