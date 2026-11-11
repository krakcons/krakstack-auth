import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE project_mcp (
    project_id text PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
    url text NOT NULL UNIQUE REFERENCES oauth_resource(identifier),
    enabled boolean NOT NULL DEFAULT false,
    dynamic_client_registration boolean NOT NULL DEFAULT false,
    scopes text[] NOT NULL DEFAULT ARRAY['mcp:read']::text[],
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
});
