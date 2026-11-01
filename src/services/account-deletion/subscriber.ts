import { BunDns } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Events } from "@krak-stack/registry/events";
import { Webhooks, WebhookAllowLoopback } from "@krak-stack/registry/webhooks";
import { allowDevelopmentWebhookLoopback } from "@/services/webhooks/schema";
import { ProjectWebhooks } from "@/services/webhooks";
import { sqlLayer } from "@/services/database";
import { workflowEngineLayer } from "@/services/workflow";
import { auditEventsLayer } from "@/services/audit/layer.server";
import {
  DeletionDispatch,
  DeletionEndpointMissing,
  DeletionNotCommitted,
  deletionEvent,
} from "./schema";

export const deletionWebhooksLayer = ProjectWebhooks.layer.pipe(
  Layer.provideMerge(Webhooks.layer),
  Layer.provide(
    Layer.succeed(WebhookAllowLoopback, allowDevelopmentWebhookLoopback),
  ),
  Layer.provide(BunDns.layer),
  Layer.provide(workflowEngineLayer),
  Layer.provide(sqlLayer),
);
export const deletionSubscriberLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const events = yield* Events;
    const webhooks = yield* Webhooks;
    const projects = yield* ProjectWebhooks;
    const sql = yield* SqlClient.SqlClient;
    yield* events.subscribe({
      name: "AuthAccountDeletionV1",
      events: [deletionEvent],
      handle: Effect.fn("AccountDeletions.dispatch")(function* (event) {
        const dispatch = yield* Schema.decodeUnknownEffect(DeletionDispatch)(
          event.properties,
        );
        const remaining =
          yield* sql`SELECT id FROM "user" WHERE id = ${dispatch.data.userId}`;
        if (remaining.length) return yield* new DeletionNotCommitted({});
        const endpoint = yield* projects.endpoint({
          projectId: dispatch.data.projectId,
        });
        if (
          !endpoint?.enabled ||
          (endpoint.events !== null &&
            !endpoint.events.includes("user.deletion_requested"))
        ) {
          return yield* new DeletionEndpointMissing({});
        }
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* webhooks.publish({
              organizationId: dispatch.data.projectId,
              eventId: dispatch.eventId,
              event: "user.deletion_requested",
              data: dispatch.data,
            });
          }),
        );
      }),
    });
  }),
);
export const accountDeletionEventsLayer = deletionSubscriberLayer.pipe(
  Layer.provideMerge(deletionWebhooksLayer),
  Layer.provideMerge(auditEventsLayer),
  Layer.provide(workflowEngineLayer),
  Layer.provide(sqlLayer),
);
