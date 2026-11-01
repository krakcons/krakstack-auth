import { Atom } from "effect/reactivity";
import { AdminApiClient } from "@/lib/admin-api-client";
import type { WebhookDeliveriesQuery } from "../schema";

export const projectWebhooksAtom = Atom.optimistic(
  AdminApiClient.query("projectWebhooks", "listProjectWebhooks", {
    reactivityKeys: ["project-webhooks"],
    timeToLive: "1 minute",
  }),
);

export const webhookDeliveriesAtom = Atom.family(
  ({
    projectId,
    query,
  }: {
    projectId: string;
    query: typeof WebhookDeliveriesQuery.Type;
  }) =>
    Atom.optimistic(
      AdminApiClient.query("projectWebhooks", "listProjectWebhookDeliveries", {
        params: { projectId },
        query,
        reactivityKeys: ["project-webhooks", `project-webhook:${projectId}`],
        timeToLive: "1 minute",
      }),
    ),
);
