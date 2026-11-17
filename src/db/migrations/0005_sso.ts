import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // Organization-managed OIDC connections. oidc_config is encrypted at rest.
  yield* sql`CREATE TABLE sso_provider (
    id text PRIMARY KEY,
    issuer text NOT NULL,
    oidc_config text,
    saml_config text,
    user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    provider_id text NOT NULL UNIQUE,
    organization_id text REFERENCES organization(id) ON DELETE CASCADE,
    domain text NOT NULL,
    domain_verified boolean NOT NULL DEFAULT false,
    enabled boolean NOT NULL DEFAULT false,
    verification_token text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id)
  )`;
  yield* sql`CREATE UNIQUE INDEX sso_provider_verified_domain_unique ON sso_provider (domain)
    WHERE enabled = true AND domain_verified = true`;
});
