import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, String } from "effect";
import { SqlClient } from "effect/sql";
import { adopt, verifyBaseline } from "../src/db/adopt";

const databaseLayer = PgClient.layerConfig({
  url: Config.Redacted(
    process.argv.includes("--test") ? "TEST_DATABASE_URL" : "DATABASE_URL",
  ),
  transformQueryNames: Config.succeed(String.camelToSnake),
  transformResultNames: Config.succeed(String.snakeToCamel),
  transformJson: Config.succeed(false),
});
const check = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(verifyBaseline);
  yield* Effect.logInfo(
    "Baseline schema verified; no database records changed.",
  );
});
BunRuntime.runMain(
  (process.argv.includes("--check")
    ? check
    : adopt.pipe(
        Effect.tap((recorded) =>
          Effect.logInfo(
            recorded
              ? "Baseline recorded; application data and legacy ledger unchanged."
              : "Existing baseline verified; migration ledger unchanged.",
          ),
        ),
      )
  ).pipe(Effect.provide(databaseLayer)),
);
