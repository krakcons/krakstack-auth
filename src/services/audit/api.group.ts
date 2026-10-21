import { EventLogRecord, EventQuery } from "@krak-stack/registry/events/schema";
import { PaginatedResponse } from "@krak-stack/registry/query";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";
import { AdminAuthMiddleware } from "@/services/auth/middleware";

export const AuditApiGroup = HttpApiGroup.make("audit")
  .add(
    HttpApiEndpoint.get("listAudit", "/admin/audit", {
      query: EventQuery,
      success: PaginatedResponse(EventLogRecord),
      error: [HttpApiError.InternalServerError],
    }),
  )
  .middleware(AdminAuthMiddleware);
