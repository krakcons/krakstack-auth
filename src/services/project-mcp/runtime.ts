import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import { ProjectMcp } from "./schema";

/** Re-read persisted policy and the current domain binding on every auth
 * request. No process-local invalidation event or restart is needed. */
export const resolveProjectMcp = Effect.fn("ProjectMcp.resolve")(
  function* (input: { projectId: string; host: string; protocol: string }) {
    const sql = yield* SqlClient.SqlClient;
    const configured = yield* SqlSchema.findAll({
      Request: Schema.String,
      Result: ProjectMcp,
      execute: (
        projectId,
      ) => sql`SELECT m.project_id, m.url, m.enabled, m.dynamic_client_registration, m.scopes
      FROM project_mcp m JOIN oauth_resource r ON r.identifier = m.url
      WHERE m.project_id = ${projectId} AND m.enabled = true AND r.disabled = false
      AND EXISTS (SELECT 1 FROM domains d WHERE d.project_id = m.project_id AND d.active = true
        AND d.hostname = ${input.host})`,
    })(input.projectId);
    const endpoint = configured[0];
    if (!endpoint) return null;
    const url = yield* Schema.decodeEffect(Schema.URLFromString)(endpoint.url);
    return url.host === input.host && url.protocol === `${input.protocol}:`
      ? endpoint
      : null;
  },
);
