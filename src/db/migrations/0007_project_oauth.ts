import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE project_oauth_flow (
    id text PRIMARY KEY,
    domain_id text NOT NULL,
    project_id text NOT NULL,
    project_origin text NOT NULL,
    browser_hash text NOT NULL,
    destination text NOT NULL,
    error_destination text NOT NULL,
    provider_options jsonb NOT NULL,
    started boolean NOT NULL DEFAULT false,
    state_hash text UNIQUE,
    state_cookie_hash text,
    callback_claimed boolean NOT NULL DEFAULT false,
    code_hash text UNIQUE,
    session_cookie text,
    expires_at timestamptz NOT NULL
  )`;
  yield* sql`CREATE INDEX project_oauth_flow_expiry_idx ON project_oauth_flow (expires_at)`;
});
