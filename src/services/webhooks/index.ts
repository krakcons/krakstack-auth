import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { Webhooks } from "@krak-stack/registry/webhooks";
import {
  ProjectWebhookSummary,
  WebhookDeliveriesQuery,
  projectWebhookName,
  legacyDeletionWebhookName,
} from "./schema";

export class ProjectWebhooks extends Context.Service<ProjectWebhooks>()(
  "auth/ProjectWebhooks",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const webhooks = yield* Webhooks;
      const list = Effect.fn("ProjectWebhooks.list")(function* () {
        return yield* SqlSchema.findAll({
          Request: Schema.Void,
          Result: ProjectWebhookSummary,
          execute: () => sql`
          SELECT p.id AS project_id, p.name AS project_name, w.url, w.enabled
          FROM project p
          LEFT JOIN LATERAL (
            SELECT url, enabled FROM webhooks
            WHERE organization_id = p.id AND name IN (${projectWebhookName}, ${legacyDeletionWebhookName})
            ORDER BY CASE WHEN name = ${projectWebhookName} THEN 0 ELSE 1 END, id
            LIMIT 1
          ) w ON true
          ORDER BY p.name, p.id`,
        })(undefined);
      });
      const endpoint = Effect.fn("ProjectWebhooks.endpoint")(function* ({
        projectId,
      }: {
        projectId: string;
      }) {
        const configured = yield* webhooks.list({ organizationId: projectId });
        return (
          configured.find((value) => value.name === projectWebhookName) ??
          configured.find(
            (value) => value.name === legacyDeletionWebhookName,
          ) ??
          null
        );
      });
      const configure = Effect.fn("ProjectWebhooks.configure")(
        function* (input: { projectId: string; url: string }) {
          const found =
            yield* sql`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
          if (!found.length) return null;
          const current = yield* endpoint(input);
          // A project endpoint handles the complete Auth event envelope. Individual
          // services publish their own event types; receiving apps route by event.
          const payload = {
            name: projectWebhookName,
            url: input.url,
            description: null,
            enabled: true,
            events: null,
            customHeaders: null,
          };
          if (current)
            yield* webhooks.update({
              organizationId: input.projectId,
              id: current.id,
              payload,
            });
          else
            yield* webhooks.create({
              organizationId: input.projectId,
              payload,
            });
          return yield* endpoint(input);
        },
        sql.withTransaction,
      );
      const deliveries = Effect.fn("ProjectWebhooks.deliveries")(function* ({
        projectId,
        query,
      }: {
        projectId: string;
        query: typeof WebhookDeliveriesQuery.Type;
      }) {
        const current = yield* endpoint({ projectId });
        if (!current) return null;
        return yield* webhooks.listDeliveries({
          ...query,
          organizationId: projectId,
          id: current.id,
        });
      });
      return { endpoint, configure, list, deliveries };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
