import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { EventQueryStandard } from "@krak-stack/registry/events/schema";
import { AuditLogTable } from "@krak-stack/registry/events/client";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { auditLogAtom } from "@/services/audit/client/atom";
import { auditEventOptions } from "@/services/audit/client/events";
import { m } from "@/paraglide/messages";

function AuditPage() {
  const state = Route.useSearch();
  const navigate = Route.useNavigate();
  const result = useAtomValue(auditLogAtom(state));
  const page = AsyncResult.getOrElse(result, () => undefined);
  return (
    <>
      <SidebarPageHeader
        title={m.audit_history_title()}
        description={m.audit_description()}
      />
      <AuditLogTable
        events={auditEventOptions()}
        messages={{
          en: { title: m.audit_history_title({}, { locale: "en" }) },
          fr: { title: m.audit_history_title({}, { locale: "fr" }) },
        }}
        entries={page?.data ?? []}
        rowCount={page?.meta.total ?? 0}
        state={state}
        onStateChange={(search) => {
          void navigate({ replace: true, search });
        }}
        loading={AsyncResult.isInitial(result) || AsyncResult.isWaiting(result)}
        error={AsyncResult.isFailure(result) ? m.audit_load_error() : undefined}
      />
    </>
  );
}

export const Route = createFileRoute("/admin/audit")({
  validateSearch: EventQueryStandard,
  component: AuditPage,
});
