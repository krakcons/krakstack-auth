import * as BunServices from "@effect/platform-bun/BunServices";
import { PgMigrator } from "@effect/sql-pg";
import { Effect } from "effect";

import legacyMigration from "./migrations/0001_legacy";

export const migrate = PgMigrator.run({
  loader: PgMigrator.fromRecord({ "1_legacy": legacyMigration }),
}).pipe(Effect.provide(BunServices.layer));
