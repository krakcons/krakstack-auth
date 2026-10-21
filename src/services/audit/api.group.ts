import { EventLogRecord } from "@krak-stack/registry/events/schema";
import { PaginatedResponse, Query } from "@krak-stack/registry/query";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";
import { AdminAuthMiddleware } from "@/services/auth/middleware";

export const AuditApiGroup = HttpApiGroup.make("audit")
  .add(
    HttpApiEndpoint.get("listAudit", "/admin/audit", {
      query: Query,
      success: PaginatedResponse(EventLogRecord),
      error: [HttpApiError.InternalServerError],
    }),
  )
  .middleware(AdminAuthMiddleware);
