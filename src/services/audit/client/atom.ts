import { Atom } from "effect/reactivity";
import { AdminApiClient } from "@/lib/admin-api-client";
import type { EventQuery } from "@krak-stack/registry/events/schema";

export const auditLogAtom = Atom.family((query: EventQuery) =>
  Atom.optimistic(AdminApiClient.query("audit", "listAudit", { query })),
);
