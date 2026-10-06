import { PgClient } from "@effect/sql-pg";
import { Config, Effect, String } from "effect";

import { migrate } from "../src/db/migrate";

const databaseLayer = PgClient.layerConfig({
  url: Config.redacted(
    process.argv.includes("--test") ? "TEST_DATABASE_URL" : "DATABASE_URL",
  ),
  transformQueryNames: Config.succeed(String.camelToSnake),
  transformResultNames: Config.succeed(String.snakeToCamel),
  transformJson: Config.succeed(false),
});

const applied = await Effect.runPromise(
  migrate.pipe(Effect.provide(databaseLayer)),
);
console.log("Applied migrations:", applied);
