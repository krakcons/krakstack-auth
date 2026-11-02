import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { m } from "@/paraglide/messages";
import { projectWebhooksAtom } from "@/services/webhooks/client/atom";
import { ProjectWebhookTable } from "@/services/webhooks/client/table";

export const Route = createFileRoute("/admin/webhooks/")({
  component: WebhooksPage,
});

function WebhooksPage() {
  const navigate = Route.useNavigate();
  const result = useAtomValue(projectWebhooksAtom);
  const rows = AsyncResult.getOrElse(result, () => []);
  return (
    <>
      <SidebarPageHeader
        title={m.project_webhook_title()}
        description={m.webhooks_description()}
      />
      <ProjectWebhookTable
        rows={rows}
        loading={AsyncResult.isInitial(result) || result.waiting}
        error={
          AsyncResult.isFailure(result) ? m.webhooks_load_error() : undefined
        }
        onSelect={(row) => {
          void navigate({
            to: "/admin/projects/$projectId/webhooks",
            params: { projectId: row.projectId },
            search: {
              page: 0,
              pageSize: 20,
            },
          });
        }}
      />
    </>
  );
}
