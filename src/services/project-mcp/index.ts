import { Context, Effect, Layer, Option, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { SqlClient, SqlSchema } from "effect/sql";
import { Events } from "@krak-stack/registry/events";

import { InvalidMcpEndpoint, ProjectMcp, ProjectMcpSettings } from "./schema";

export class ProjectMcpService extends Context.Service<ProjectMcpService>()(
  "auth/ProjectMcp",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const events = yield* Events;
      const random = yield* SecureRandom.SecureRandom.pipe(
        Effect.provide(SecureRandom.layerWebCrypto),
      );
      const find = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: ProjectMcp,
        execute: (projectId) =>
          sql`SELECT project_id, url, enabled, dynamic_client_registration, scopes FROM project_mcp WHERE project_id = ${projectId}`,
      });
      const get = Effect.fn("ProjectMcp.get")(function* ({
        projectId,
      }: {
        projectId: string;
      }) {
        return Option.getOrNull(yield* find(projectId));
      });
      const configure = Effect.fn("ProjectMcp.configure")(function* ({
        projectId,
        settings,
      }: {
        projectId: string;
        settings: ProjectMcpSettings;
      }) {
        const payload =
          yield* Schema.decodeEffect(ProjectMcpSettings)(settings);
        const projects =
          yield* sql`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
        if (!projects.length) return null;
        const url = yield* Schema.decodeEffect(Schema.URLFromString)(
          payload.url,
        );
        const identifier = url.href;
        const current = yield* get({ projectId });
        const domains = yield* SqlSchema.findAll({
          Request: Schema.String,
          Result: Schema.Struct({
            projectId: Schema.NullOr(Schema.String),
          }).annotate({ identifier: "McpDomainBinding" }),
          execute: (host) =>
            sql`SELECT project_id FROM domains WHERE hostname = ${host} AND active = true FOR SHARE`,
        })(url.host);
        if (
          (domains.length !== 1 || domains[0]?.projectId !== projectId) &&
          !(current?.url === identifier && !payload.enabled)
        ) {
          return yield* new InvalidMcpEndpoint({});
        }
        const owned =
          yield* sql`SELECT project_id FROM project_mcp WHERE url = ${identifier} AND project_id <> ${projectId}`;
        if (owned.length) return yield* new InvalidMcpEndpoint({});
        if (current && (current.url !== identifier || !payload.enabled)) {
          yield* sql`UPDATE oauth_resource SET disabled = true, policy_version = policy_version + 1, updated_at = now() WHERE identifier = ${current.url}`;
          yield* sql`DELETE FROM oauth_client_resource WHERE resource_id = ${current.url}`;
        }
        const id = yield* random.uuidV7();
        const scopes = Array.from(
          new Set([
            ...payload.scopes,
            "offline_access",
            "openid",
            "profile",
            "email",
          ]),
        );
        yield* sql`INSERT INTO oauth_resource (id, identifier, name, allowed_scopes, disabled, created_at, updated_at)
        VALUES (${id}, ${identifier}, ${projectId}, ${scopes}, ${!payload.enabled}, now(), now())
        ON CONFLICT (identifier) DO UPDATE SET allowed_scopes = EXCLUDED.allowed_scopes,
          disabled = EXCLUDED.disabled, policy_version = oauth_resource.policy_version + 1, updated_at = now()`;
        yield* sql`INSERT INTO project_mcp (project_id, url, enabled, dynamic_client_registration, scopes)
        VALUES (${projectId}, ${identifier}, ${payload.enabled}, ${payload.dynamicClientRegistration}, ${Array.from(new Set(payload.scopes))})
        ON CONFLICT (project_id) DO UPDATE SET url = EXCLUDED.url, enabled = EXCLUDED.enabled,
          dynamic_client_registration = EXCLUDED.dynamic_client_registration, scopes = EXCLUDED.scopes, updated_at = now()`;
        yield* events.track({
          name: "project.mcp.updated",
          category: "audit",
          target: { id: projectId, name: projectId, type: "project" },
          properties: {
            enabled: payload.enabled,
            dynamicClientRegistration: payload.dynamicClientRegistration,
            scopes: payload.scopes,
          },
        });
        return yield* get({ projectId });
      }, sql.withTransaction);
      return { get, configure };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
