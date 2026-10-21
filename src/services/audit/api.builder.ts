import { Events } from "@krak-stack/registry/events";
import { Config, Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { AdminApi } from "@/api";

// This administrative API manages global auth configuration. Access is limited
// to verified server admins, and records live in the configured admin tenant.
export const auditHandler = HttpApiBuilder.group(
  AdminApi,
  "audit",
  (handlers) =>
    handlers.handle("listAudit", ({ query }) =>
      Effect.gen(function* () {
        const organizationId = yield* Config.String(
          "VITE_KRAKSTACK_AUTH_ORGANIZATION_ID",
        );
        const events = yield* Events;
        return yield* events.list({
          ...query,
          organizationId,
          category: "audit",
        });
      }).pipe(Effect.mapError(() => new HttpApiError.InternalServerError({}))),
    ),
);
