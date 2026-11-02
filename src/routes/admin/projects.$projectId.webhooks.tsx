import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { TriangleAlert } from "lucide-react";
import { m } from "@/paraglide/messages";
import { projectWebhooksAtom } from "@/services/webhooks/client/atom";
import { WebhookDeliveriesTable } from "@/services/webhooks/client/table";
import { WebhooksPageSearch } from "@/services/webhooks/schema";

export const Route = createFileRoute("/admin/projects/$projectId/webhooks")({
  validateSearch: Schema.toStandardSchemaV1(WebhooksPageSearch),
  beforeLoad: ({ params, search }) => {
    if (search.tab === "settings")
      throw redirect({
        to: "/admin/projects/$projectId/settings",
        params,
        hash: "webhooks",
      });
  },
  component: WebhookDetailsPage,
});

function WebhookDetailsPage() {
  const { projectId } = Route.useParams();
  const { tab: _tab, ...query } = Route.useSearch();
  const navigate = Route.useNavigate();
  const result = useAtomValue(projectWebhooksAtom);
  const project = AsyncResult.getOrElse(result, () => []).find(
    (row) => row.projectId === projectId,
  );
  return (
    <>
      <div className="flex flex-col gap-6">
        {project ? (
          <>
            {!project.url || !project.enabled ? (
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
              >
                <TriangleAlert
                  className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <p className="font-medium">{m.webhooks_disabled_warning()}</p>
                  <Link
                    to="/admin/projects/$projectId/settings"
                    params={{ projectId }}
                    hash="webhooks"
                    className="font-medium underline underline-offset-4"
                  >
                    {m.webhooks_open_project_settings()}
                  </Link>
                </div>
              </div>
            ) : null}
            {project.url ? (
              <WebhookDeliveriesTable
                projectId={projectId}
                query={query}
                onStateChange={(next) => {
                  void navigate({
                    replace: true,
                    search: next,
                  });
                }}
              />
            ) : null}
          </>
        ) : (
          <p role="status">
            {AsyncResult.isFailure(result)
              ? m.webhooks_load_error()
              : AsyncResult.isInitial(result)
                ? m.webhooks_loading()
                : m.webhooks_project_unavailable()}
          </p>
        )}
      </div>
    </>
  );
}
