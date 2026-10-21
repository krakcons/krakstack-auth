import { Atom } from "effect/reactivity";
import { AdminApiClient } from "@/lib/admin-api-client";
import type { QueryType } from "@krak-stack/registry/query";

export const auditLogAtom = Atom.family((query: QueryType) =>
  Atom.optimistic(AdminApiClient.query("audit", "listAudit", { query })),
);
