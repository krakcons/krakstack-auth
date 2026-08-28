import * as PgDrizzle from "drizzle-orm/effect-postgres";
import {
  Config,
  Context,
  Effect,
  Layer,
  ManagedRuntime,
  Redacted,
  Schema,
} from "effect";
import { PgClient } from "@effect/sql-pg";
import { Pool, types } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "@/db/schema";

const DatabasePoolSize = Schema.NumberFromString.check(
  Schema.isBetween({ minimum: 1, maximum: 100 }),
).annotate({ identifier: "DatabasePoolSize" });

const databasePoolSize = process.env.DATABASE_POOL_SIZE
  ? Schema.decodeUnknownSync(DatabasePoolSize)(process.env.DATABASE_POOL_SIZE)
  : 5;

export const databasePool = new Pool({
  application_name: "krakstack-auth",
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: databasePoolSize,
});

databasePool.on("error", (error) => {
  console.error("[PostgreSQL] Pool error", error);
});

const pgTypes = {
  getTypeParser: (typeId: number, format?: "text" | "binary") => {
    if (
      [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)
    ) {
      return (val: any) => val;
    }
    return types.getTypeParser(typeId, format);
  },
};

const sharedPgLayer = PgClient.layerFrom(
  PgClient.fromPool({
    acquire: Effect.succeed(databasePool),
    applicationName: "krakstack-auth",
    types: pgTypes,
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
  });

const pgLayerFromConfig = (name: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const url = yield* Config.redacted(name);
      return pgLayer(url);
    }),
  );

export class DB extends Context.Service<DB>()("DB", {
  make: PgDrizzle.makeWithDefaults({ relations }),
}) {
  static readonly baseLayer = Layer.effect(this, this.make);

  static readonly layer = this.baseLayer.pipe(Layer.provide(sharedPgLayer));

  static readonly testLayer = this.baseLayer.pipe(
    Layer.provide(pgLayerFromConfig("TEST_DATABASE_URL")),
  );
}

const databaseRuntime = ManagedRuntime.make(DB.layer);

export const runWithDatabase = <A, E>(effect: Effect.Effect<A, E, DB>) =>
  databaseRuntime.runPromise(effect);

export const db = drizzle({
  client: databasePool,
  relations,
});
