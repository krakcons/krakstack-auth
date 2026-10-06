import {
  Config,
  Effect,
  Layer,
  ManagedRuntime,
  Redacted,
  Schema,
  String,
} from "effect";
import { PgClient } from "@effect/sql-pg";
import { SqlClient } from "effect/unstable/sql";
import { defaults, Pool, types } from "pg";

// The existing schema uses timestamp without time zone and stores UTC.
// Keep that convention for both Effect SQL and Better Auth's native pg adapter.
defaults.parseInputDatesAsUTC = true;
const TimestampUtc = Schema.DateFromString.annotate({
  identifier: "PostgresTimestampUtc",
});
const pgTypes = {
  getTypeParser: (typeId: number, format?: "text" | "binary") =>
    typeId === 1114 && format !== "binary"
      ? (value: string) => Schema.decodeUnknownSync(TimestampUtc)(`${value}Z`)
      : types.getTypeParser(typeId, format),
};

const DatabasePoolSize = Schema.NumberFromString.check(
  Schema.isBetween({ minimum: 1, maximum: 100 }),
).annotate({ identifier: "DatabasePoolSize" });

const databasePoolSize = process.env.DATABASE_POOL_SIZE
  ? Schema.decodeUnknownSync(DatabasePoolSize)(process.env.DATABASE_POOL_SIZE)
  : 5;

export const databasePool = new Pool({
  application_name: "krakstack-auth",
  connectionString:
    process.env.NODE_ENV === "test"
      ? process.env.TEST_DATABASE_URL
      : process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: databasePoolSize,
  types: pgTypes,
});

databasePool.on("error", (error) => {
  console.error("[PostgreSQL] Pool error", error);
});

const naming = {
  transformQueryNames: String.camelToSnake,
  transformResultNames: String.snakeToCamel,
  transformJson: false,
};

export const sqlLayer = PgClient.layerFrom(
  PgClient.fromPool({
    acquire: Effect.succeed(databasePool),
    applicationName: "krakstack-auth",
    types: pgTypes,
    ...naming,
  }),
);

const pgLayer = (url: Redacted.Redacted) =>
  PgClient.layer({
    url,
    applicationName: "krakstack-auth-test",
    connectTimeout: "5 seconds",
    idleTimeout: "30 seconds",
    maxConnections: databasePoolSize,
    types: pgTypes,
    ...naming,
  });

const pgLayerFromConfig = (name: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const url = yield* Config.redacted(name);
      return pgLayer(url);
    }),
  );

export const sqlTestLayer = pgLayerFromConfig("TEST_DATABASE_URL");

const databaseRuntime = ManagedRuntime.make(sqlLayer);

export const runWithDatabase = <A, E>(
  effect: Effect.Effect<A, E, SqlClient.SqlClient>,
) => databaseRuntime.runPromise(effect);
