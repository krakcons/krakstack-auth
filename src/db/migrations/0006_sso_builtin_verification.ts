import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // The old image requires this column to validate the schema for all auth
  // requests. The new image ignores it, so allow inserts without a token.
  yield* sql`ALTER TABLE sso_provider
    ALTER COLUMN verification_token SET DEFAULT gen_random_uuid()::text`;
});
