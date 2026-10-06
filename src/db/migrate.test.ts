import { describe, expect, it } from "@effect/vitest";
import * as BunServices from "@effect/platform-bun/BunServices";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Config, Effect, Redacted, Schema, String } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { adopt, verifyBaseline } from "./adopt";
import { migrate } from "./migrate";
import initialMigration from "./migrations/0001_initial";
import { applicationTables } from "./migration-schema";

const Presence = Schema.Struct({ present: Schema.Boolean }).annotate({
  identifier: "MigrationTestPresence",
});
const Snapshot = Schema.Struct({ rows: Schema.String }).annotate({
  identifier: "MigrationTestSnapshot",
});

// Never migrate/reset the application's databases; allocate fixtures only on the
// configured test cluster. Database creation privileges are required.
const withDatabase = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const parent = yield* SqlClient.SqlClient;
    const url = new URL(
      Redacted.value(yield* Config.redacted("TEST_DATABASE_URL")),
    );
    const name = `auth_migration_test_${crypto.randomUUID().replaceAll("-", "")}`;
    return yield* Effect.acquireUseRelease(
      parent`CREATE DATABASE ${parent(name)}`,
      () => {
        url.pathname = `/${name}`;
        return program.pipe(
          Effect.provide(
            PgClient.layer({
              url: Redacted.make(url.toString()),
              maxConnections: 2,
              transformQueryNames: String.camelToSnake,
              transformResultNames: String.snakeToCamel,
              transformJson: false,
            }),
          ),
        );
      },
      () => parent`DROP DATABASE ${parent(name)}`.pipe(Effect.orDie),
    );
  }).pipe(
    Effect.provide(
      PgClient.layerConfig({
        url: Config.redacted("TEST_DATABASE_URL"),
        maxConnections: Config.succeed(1),
      }),
    ),
    Effect.provide(BunServices.layer),
  );

const noLedger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] =
    yield* sql`SELECT to_regclass('public.effect_sql_migrations') IS NOT NULL AS present`.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Presence))),
    );
  expect(row?.present).toBe(false);
});

const legacyLedger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE SCHEMA drizzle`;
  yield* sql`CREATE TABLE drizzle.__drizzle_migrations (hash text NOT NULL, created_at bigint)`;
  yield* sql`INSERT INTO drizzle.__drizzle_migrations VALUES ('unverified-historical-hash', ${Date.UTC(2026, 8, 25, 15, 4, 21)})`;
});
const installExisting = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(initialMigration);
  yield* legacyLedger;
});

const applicationSnapshot = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows: Array<string> = [];
  for (const name of applicationTables) {
    const snapshot = yield* SqlSchema.findOne({
      Request: Schema.Void,
      Result: Snapshot,
      execute: () =>
        sql`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]'::jsonb)::text AS rows FROM ${sql(`public.${name}`)} t`,
    })();
    rows.push(snapshot.rows);
  }
  return rows;
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Verified Effect SQL baseline",
  () => {
    it.effect(
      "installs the independently verified current schema and repeats safely",
      () =>
        withDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            expect(yield* migrate).toEqual([[1, "legacy"]]);
            yield* sql.withTransaction(verifyBaseline);
            expect(yield* migrate).toEqual([]);
          }),
        ),
    );
    it.effect(
      "requires explicit adoption for an existing application schema",
      () =>
        withDatabase(
          Effect.gen(function* () {
            yield* installExisting;
            expect(
              (yield* initialMigration.pipe(Effect.flip)).message,
            ).toContain("verified adoption");
            expect((yield* migrate.pipe(Effect.exit))._tag).toBe("Failure");
            yield* noLedger;
          }),
        ),
    );
    it.effect(
      "does not falsely adopt an empty schema based on a latest Drizzle timestamp",
      () =>
        withDatabase(
          Effect.gen(function* () {
            yield* legacyLedger;
            expect((yield* adopt.pipe(Effect.flip)).message).toContain(
              "Baseline schema differs",
            );
            yield* noLedger;
            // Without application objects, ordinary migration is a genuine fresh install.
            expect(yield* migrate).toEqual([[1, "legacy"]]);
            const sql = yield* SqlClient.SqlClient;
            yield* sql.withTransaction(verifyBaseline);
          }),
        ),
    );
    it.effect(
      "adopts without changing users, sessions, keys, OAuth arrays/JSON or any legacy record",
      () =>
        withDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* installExisting;
            yield* sql`INSERT INTO "user" (id, name, email, metadata) VALUES ('u', 'Preserved', 'preserved@example.test', '{"legacyField":"keep","phones":[]}'::jsonb)`;
            yield* sql`INSERT INTO organization (id, name, slug, created_at, user_id) VALUES ('org', 'Personal', 'personal', now(), 'u')`;
            yield* sql`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ('m', 'org', 'u', 'owner', now())`;
            yield* sql`INSERT INTO session (id, token, user_id, expires_at, updated_at, active_organization_id) VALUES ('s', 'preserved-session-token', 'u', now() + interval '1 day', now(), 'org')`;
            yield* sql`INSERT INTO apikey (id, reference_id, key, created_at, updated_at, permissions, metadata) VALUES ('k', 'u', 'preserved-key', now(), now(), '{"project":["auth:proxy"]}', '{"allowedOrigins":["https://example.test"]}')`;
            yield* sql`INSERT INTO oauth_client (id, client_id, redirect_uris, scopes, metadata) VALUES ('c', 'client', ARRAY['https://example.test/callback'], ARRAY['openid','profile'], '{"camelCase":"keep"}'::jsonb)`;
            const before = yield* applicationSnapshot;
            const history =
              yield* sql`SELECT * FROM drizzle.__drizzle_migrations`;
            yield* sql.withTransaction(verifyBaseline);
            yield* noLedger;
            expect(yield* adopt).toBe(true);
            expect(yield* adopt).toBe(false);
            expect(yield* migrate).toEqual([]);
            expect(yield* applicationSnapshot).toEqual(before);
            expect(
              yield* sql`SELECT * FROM drizzle.__drizzle_migrations`,
            ).toEqual(history);
          }),
        ),
    );
    it.effect(
      "verifies an existing 1_legacy Effect baseline without rewriting it",
      () =>
        withDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* migrate;
            const before = yield* sql`SELECT * FROM effect_sql_migrations`;
            expect(yield* adopt).toBe(false);
            expect(yield* sql`SELECT * FROM effect_sql_migrations`).toEqual(
              before,
            );
          }),
        ),
    );
    for (const [name, statement, table] of [
      [
        "default",
        "ALTER TABLE apikey ALTER COLUMN rate_limit_max SET DEFAULT 10",
        "apikey",
      ],
      [
        "nullability",
        "ALTER TABLE session ALTER COLUMN token DROP NOT NULL",
        "session",
      ],
      [
        "foreign key",
        "ALTER TABLE member DROP CONSTRAINT member_user_id_user_id_fkey",
        "member",
      ],
      [
        "index",
        'DROP INDEX "projectUser_projectId_userId_uidx"',
        "project_user",
      ],
      [
        "column type",
        "ALTER TABLE oauth_client ALTER COLUMN scopes TYPE jsonb USING to_jsonb(scopes)",
        "oauth_client",
      ],
      ["row security", 'ALTER TABLE "user" ENABLE ROW LEVEL SECURITY', "user"],
      [
        "missing table",
        "DROP TABLE oauth_client_assertion",
        "oauth_client_assertion",
      ],
    ] as const) {
      it.effect(
        `rejects incompatible ${name} without recording a baseline`,
        () =>
          withDatabase(
            Effect.gen(function* () {
              const sql = yield* SqlClient.SqlClient;
              yield* installExisting;
              yield* sql.unsafe(statement);
              expect((yield* adopt.pipe(Effect.flip)).message).toContain(table);
              yield* noLedger;
            }),
          ),
      );
    }
    it.effect(
      "refuses drift even when the previous bridge recorded migration 1",
      () =>
        withDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* migrate;
            const ledger = yield* sql`SELECT * FROM effect_sql_migrations`;
            yield* sql`ALTER TABLE "user" ALTER COLUMN email_verified SET DEFAULT true`;
            expect((yield* adopt.pipe(Effect.flip)).message).toContain("user");
            expect(yield* sql`SELECT * FROM effect_sql_migrations`).toEqual(
              ledger,
            );
          }),
        ),
    );
    it.effect("refuses unexpected native history without rewriting it", () =>
      withDatabase(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* migrate;
          yield* sql`UPDATE effect_sql_migrations SET name = 'unknown'`;
          const before = yield* sql`SELECT * FROM effect_sql_migrations`;
          expect((yield* adopt.pipe(Effect.flip)).message).toContain(
            "Unexpected native migration history",
          );
          expect(yield* sql`SELECT * FROM effect_sql_migrations`).toEqual(
            before,
          );
        }),
      ),
    );
    it.effect(
      "rolls back failed fresh installation and preserves unmanaged objects",
      () =>
        withDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            // This non-table object collides late in the DDL after earlier CREATE TABLEs.
            yield* sql`CREATE TYPE verification AS ENUM ('preserve')`;
            expect((yield* migrate.pipe(Effect.exit))._tag).toBe("Failure");
            yield* noLedger;
            expect(
              yield* sql`SELECT enumlabel AS marker FROM pg_enum WHERE enumtypid = 'public.verification'::regtype`,
            ).toEqual([{ marker: "preserve" }]);
            const [row] =
              yield* sql`SELECT to_regclass('public.account') IS NOT NULL AS present`.pipe(
                Effect.flatMap(
                  Schema.decodeUnknownEffect(Schema.Array(Presence)),
                ),
              );
            expect(row?.present).toBe(false);
          }),
        ),
    );
    it.effect("serializes concurrent fresh startup", () =>
      withDatabase(
        Effect.gen(function* () {
          const results = yield* Effect.all([migrate, migrate], {
            concurrency: 2,
          });
          expect(
            results.map((rows) => rows.length).sort((a, b) => a - b),
          ).toEqual([0, 1]);
        }),
      ),
    );
    it.effect("serializes concurrent adoption and startup", () =>
      withDatabase(
        Effect.gen(function* () {
          yield* installExisting;
          const results = yield* Effect.all([adopt, adopt], { concurrency: 2 });
          expect(results.filter(Boolean)).toHaveLength(1);
          expect(yield* migrate).toEqual([]);
        }),
      ),
    );
    it.effect(
      "applies subsequent upgrades once and rolls back their failures",
      () =>
        withDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* installExisting;
            yield* adopt;
            const upgrade = PgMigrator.run({
              loader: PgMigrator.fromRecord({
                "1_legacy": initialMigration,
                "2_upgrade": sql`CREATE TABLE upgrade_probe (id text PRIMARY KEY)`,
              }),
            });
            expect(yield* upgrade).toEqual([[2, "upgrade"]]);
            expect(yield* upgrade).toEqual([]);
            const failing = PgMigrator.run({
              loader: PgMigrator.fromRecord({
                "1_legacy": initialMigration,
                "2_upgrade": sql`CREATE TABLE upgrade_probe (id text PRIMARY KEY)`,
                "3_failure": Effect.gen(function* () {
                  yield* sql`ALTER TABLE upgrade_probe ADD COLUMN marker text`;
                  return yield* Effect.fail(
                    new PgMigrator.MigrationError({
                      kind: "BadState",
                      message: "test rollback",
                    }),
                  );
                }),
              }),
            });
            expect((yield* failing.pipe(Effect.exit))._tag).toBe("Failure");
            const [row] =
              yield* sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'upgrade_probe' AND column_name = 'marker') AS present`.pipe(
                Effect.flatMap(
                  Schema.decodeUnknownEffect(Schema.Array(Presence)),
                ),
              );
            expect(row?.present).toBe(false);
            expect(yield* upgrade).toEqual([]);
          }),
        ),
    );
  },
);
