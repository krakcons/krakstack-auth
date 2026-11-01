import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { History } from "lucide-react";
import { DataTable } from "@krak-stack/registry/data-table";
import { WebhookDeliveryTable } from "@krak-stack/registry/webhooks/client";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { auditEventOptions } from "@/services/audit/client/events";
import type { ProjectWebhookSummary, WebhookDeliveriesQuery } from "../schema";
import { webhookDeliveriesAtom } from "./atom";

export const ProjectWebhookTable = ({
  rows,
  onSelect,
  loading,
  error,
}: {
  rows: readonly (typeof ProjectWebhookSummary.Type)[];
  onSelect: (project: typeof ProjectWebhookSummary.Type) => void;
  loading: boolean;
  error: string | undefined;
}) => (
  <DataTable
    locale={getLocale()}
    getRowId={(row) => row.projectId}
    rowData={rows}
    columnDefs={[
      { field: "projectName", headerName: m.project() },
      {
        field: "url",
        headerName: m.project_webhook_url(),
        valueGetter: ({ data }) => data.url ?? m.webhooks_not_configured(),
      },
      {
        field: "enabled",
        headerName: m.webhooks_status(),
        valueGetter: ({ data }) =>
          data.enabled === null
            ? m.webhooks_not_configured()
            : data.enabled
              ? m.webhooks_enabled()
              : m.webhooks_disabled(),
      },
    ]}
    status={{ loading, error }}
    onRowClicked={onSelect}
    features={{
      search: true,
      rowActions: {
        items: [
          { name: m.webhooks_activity(), icon: <History />, onClick: onSelect },
        ],
      },
    }}
  />
);

export const WebhookDeliveriesTable = ({
  projectId,
  query,
  onStateChange,
}: {
  projectId: string;
  query: typeof WebhookDeliveriesQuery.Type;
  onStateChange: (query: typeof WebhookDeliveriesQuery.Type) => void;
}) => {
  const atom = webhookDeliveriesAtom({ projectId, query });
  const result = useAtomValue(atom);
  const page = AsyncResult.getOrElse(result, () => undefined);
  return (
    <WebhookDeliveryTable
      locale={getLocale()}
      entries={page?.data ?? []}
      rowCount={page?.meta.total ?? 0}
      events={auditEventOptions().filter(
        ({ value }) =>
          value === "user.deletion_requested" ||
          value === "organization.deletion_requested",
      )}
      state={query}
      onStateChange={onStateChange}
      status={{
        loading: AsyncResult.isInitial(result) || result.waiting,
        error: AsyncResult.isFailure(result)
          ? m.webhooks_load_error()
          : undefined,
      }}
    />
  );
};
