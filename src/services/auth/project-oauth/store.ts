import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { Flow, Redemption } from "./schema";

export class ProjectOAuthStore extends Context.Service<ProjectOAuthStore>()(
  "Auth/ProjectOAuthStore",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const idRow = Schema.Struct({ id: Schema.String });

      const create = Effect.fn("ProjectOAuth.create")(function* ({
        browserHash,
        ...flow
      }: typeof Flow.Type & { browserHash: string }) {
        yield* sql`DELETE FROM project_oauth_flow WHERE expires_at <= now()`;
        yield* sql`INSERT INTO project_oauth_flow
          (id, domain_id, project_id, project_origin, browser_hash, destination,
           error_destination, provider_options, expires_at)
          VALUES (${flow.id}, ${flow.domainId}, ${flow.projectId}, ${flow.projectOrigin},
            ${browserHash}, ${flow.destination}, ${flow.errorDestination},
            ${JSON.stringify(flow.providerOptions)}::jsonb, now() + interval '60 seconds')`;
      });

      const claimStart = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Flow,
        execute: (id) => sql`UPDATE project_oauth_flow
          SET started = true, expires_at = now() + interval '5 minutes'
          WHERE id = ${id} AND NOT started AND expires_at > now()
          RETURNING *`,
      });

      const bindState = SqlSchema.findOneOption({
        Request: Schema.Struct({
          id: Schema.String,
          stateHash: Schema.String,
          stateCookieHash: Schema.String,
        }),
        Result: idRow,
        execute: ({ id, stateHash, stateCookieHash }) => sql`UPDATE project_oauth_flow
          SET state_hash = ${stateHash}, state_cookie_hash = ${stateCookieHash}
          WHERE id = ${id} AND started AND state_hash IS NULL AND expires_at > now()
          RETURNING id`,
      });

      const findCallback = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Flow,
        execute: (stateHash) => sql`SELECT * FROM project_oauth_flow
          WHERE state_hash = ${stateHash}`,
      });

      const claimCallback = SqlSchema.findOneOption({
        Request: Schema.Struct({ id: Schema.String, stateCookieHash: Schema.String }),
        Result: idRow,
        execute: ({ id, stateCookieHash }) => sql`UPDATE project_oauth_flow
          SET callback_claimed = true
          WHERE id = ${id} AND state_cookie_hash = ${stateCookieHash}
            AND NOT callback_claimed AND expires_at > now()
          RETURNING id`,
      });

      const complete = SqlSchema.findOneOption({
        Request: Schema.Struct({
          id: Schema.String,
          codeHash: Schema.String,
          sessionCookie: Schema.String,
        }),
        Result: idRow,
        execute: ({ id, codeHash, sessionCookie }) => sql`UPDATE project_oauth_flow
          SET code_hash = ${codeHash}, session_cookie = ${sessionCookie},
            expires_at = now() + interval '45 seconds'
          WHERE id = ${id} AND callback_claimed AND code_hash IS NULL
            AND expires_at > now()
          RETURNING id`,
      });

      const redeem = SqlSchema.findOneOption({
        Request: Schema.Struct({
          googleEnabled: Schema.Boolean,
          ssoEnabled: Schema.Boolean,
          codeHash: Schema.String,
          browserHash: Schema.String,
          projectOrigin: Schema.String,
          projectId: Schema.String,
          domainId: Schema.String,
        }),
        Result: Redemption,
        // Match all bindings and consume in a single statement, even across replicas.
        execute: ({ codeHash, browserHash, projectOrigin, projectId, domainId, googleEnabled, ssoEnabled }) =>
          sql`DELETE FROM project_oauth_flow
            WHERE code_hash = ${codeHash} AND browser_hash = ${browserHash}
              AND project_origin = ${projectOrigin} AND project_id = ${projectId}
              AND domain_id = ${domainId} AND expires_at > now()
              AND CASE WHEN provider_options ? 'providerId'
                THEN ${ssoEnabled}::boolean ELSE ${googleEnabled}::boolean END
            RETURNING destination, session_cookie`,
      });

      return { create, claimStart, bindState, findCallback, claimCallback, complete, redeem };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
