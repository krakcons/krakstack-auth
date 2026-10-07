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
import { SqlClient } from "effect/sql";
import { defaults, Pool } from "pg";

// The existing schema uses timestamp without time zone and stores UTC.
defaults.parseInputDatesAsUTC = true;

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
});

databasePool.on("error", (error) => {
  console.error("[PostgreSQL] Pool error", error);
});

const naming = {
  transformQueryNames: String.camelToSnake,
  transformResultNames: String.snakeToCamel,
  transformJson: false,
};

// Effect 4 uses its native PostgreSQL pool; Better Auth retains the pg pool above.
// Native timestamp codecs already decode timestamp-without-time-zone as UTC.
export const sqlLayer = PgClient.layerConfig({
  url: Config.Redacted(
    process.env.NODE_ENV === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL",
  ),
  applicationName: Config.succeed("krakstack-auth"),
  connectTimeout: Config.succeed("5 seconds"),
  idleTimeout: Config.succeed("30 seconds"),
  maxConnections: Config.succeed(databasePoolSize),
  startupParameters: Config.succeed({ TimeZone: "UTC" }),
  transformQueryNames: Config.succeed(naming.transformQueryNames),
  transformResultNames: Config.succeed(naming.transformResultNames),
  transformJson: Config.succeed(naming.transformJson),
});

const pgLayer = (url: Redacted.Redacted) =>
  PgClient.layer({
    url,
    applicationName: "krakstack-auth-test",
    connectTimeout: "5 seconds",
    idleTimeout: "30 seconds",
    maxConnections: databasePoolSize,
    startupParameters: { TimeZone: "UTC" },
    ...naming,
  });

const pgLayerFromConfig = (name: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const url = yield* Config.Redacted(name);
      return pgLayer(url);
    }),
  );

export const sqlTestLayer = pgLayerFromConfig("TEST_DATABASE_URL");

const databaseRuntime = ManagedRuntime.make(sqlLayer);

export const runWithDatabase = <A, E>(
  effect: Effect.Effect<A, E, SqlClient.SqlClient>,
) => databaseRuntime.runPromise(effect);
