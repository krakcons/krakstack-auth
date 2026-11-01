import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // A user deletion must never cascade into shared organization data.
  yield* sql`ALTER TABLE organization DROP CONSTRAINT organization_user_id_user_id_fkey`;
  yield* sql`ALTER TABLE organization ADD CONSTRAINT organization_user_id_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL`;
  yield* sql`ALTER TABLE oauth_client DROP CONSTRAINT oauth_client_user_id_user_id_fkey`;
  yield* sql`ALTER TABLE oauth_client ADD CONSTRAINT oauth_client_user_id_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL`;
});
