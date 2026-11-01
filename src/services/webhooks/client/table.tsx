import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";
import { FileJson, History } from "lucide-react";
import {
  DataTable,
  type DataTableColDef,
} from "@krak-stack/registry/data-table";
import { CodeBlock } from "@krak-stack/registry/code-block";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import type {
  ProjectWebhookSummary,
  WebhookDeliveriesQuery,
  WebhookDelivery,
} from "../schema";
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
  const [selected, setSelected] = useState<typeof WebhookDelivery.Type | null>(
    null,
  );
  const labels = {
    pending: m.webhooks_pending(),
    success: m.webhooks_success(),
    failed: m.webhooks_failed(),
  };
  const columns: DataTableColDef<typeof WebhookDelivery.Type>[] = [
    { field: "id", headerName: m.webhooks_identifier() },
    { field: "event", headerName: m.webhooks_event(), filterable: false },
    {
      field: "status",
      headerName: m.webhooks_status(),
      valueGetter: ({ data }) => labels[data.status],
      filterValueGetter: ({ data }) => data.status,
      filterOptions: Object.entries(labels).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      field: "retries",
      headerName: m.webhooks_retries(),
      sortable: false,
      filterable: false,
    },
    {
      field: "error",
      headerName: m.webhooks_error(),
      sortable: false,
      filterable: false,
    },
    {
      field: "retryAt",
      headerName: m.webhooks_retry_at(),
      type: "dateTime",
      sortable: false,
      filterable: false,
      valueGetter: ({ data }) =>
        data.status === "pending" ? data.retryAt : null,
    },
    {
      field: "createdAt",
      headerName: m.webhooks_created_at(),
      type: "dateTime",
    },
    {
      field: "completedAt",
      headerName: m.webhooks_completed_at(),
      type: "dateTime",
    },
    {
      colId: "payload",
      headerName: m.webhooks_payload(),
      sortable: false,
      filterable: false,
      cellRenderer: ({ data }) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(data)}>
          <FileJson />
          {m.webhooks_view_payload()}
        </Button>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <DataTable
        locale={getLocale()}
        rowData={page?.data ?? []}
        getRowId={(row) => row.id}
        columnDefs={columns}
        initialState={{ columnVisibility: { id: false } }}
        state={query}
        onStateChange={onStateChange}
        status={{
          loading: AsyncResult.isInitial(result) || result.waiting,
          error: AsyncResult.isFailure(result)
            ? m.webhooks_load_error()
            : undefined,
        }}
        features={{
          search: true,
          pagination: { mode: "server", rowCount: page?.meta.total ?? 0 },
        }}
      />
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{m.webhooks_payload()}</DialogTitle>
          </DialogHeader>
          <CodeBlock
            code={JSON.stringify(selected?.data ?? null, null, 2)}
            language="json"
            locale={getLocale()}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
