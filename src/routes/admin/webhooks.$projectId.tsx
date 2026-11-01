import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";
import { ProjectWebhook } from "@/services/projects/client/webhook";
import { projectWebhooksAtom } from "@/services/webhooks/client/atom";
import { WebhookDeliveriesTable } from "@/services/webhooks/client/table";
import { WebhooksPageSearch } from "@/services/webhooks/schema";

export const Route = createFileRoute("/admin/webhooks/$projectId")({
  validateSearch: Schema.toStandardSchemaV1(WebhooksPageSearch),
  component: WebhookDetailsPage,
});

function WebhookDetailsPage() {
  const { projectId } = Route.useParams();
  const { tab = "activity", ...query } = Route.useSearch();
  const navigate = Route.useNavigate();
  const result = useAtomValue(projectWebhooksAtom);
  const project = AsyncResult.getOrElse(result, () => []).find(
    (row) => row.projectId === projectId,
  );
  return (
    <>
      <SidebarPageHeader
        title={project?.projectName ?? m.project_webhook_title()}
        description={project?.url ?? m.project_webhook_description()}
      />
      <div className="flex flex-col gap-6">
        {project ? (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const next = Schema.decodeUnknownOption(
                Schema.Literals(["activity", "settings"]),
              )(value);
              if (next._tag === "Some")
                void navigate({
                  replace: true,
                  search: (current) => ({ ...current, tab: next.value }),
                });
            }}
          >
            <TabsList>
              <TabsTrigger value="activity">
                {m.webhooks_activity()}
              </TabsTrigger>
              <TabsTrigger value="settings">
                {m.webhooks_settings()}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="activity" className="pt-4">
              {project.url ? (
                <WebhookDeliveriesTable
                  projectId={projectId}
                  query={query}
                  onStateChange={(next) => {
                    void navigate({
                      replace: true,
                      search: { ...next, tab: "activity" },
                    });
                  }}
                />
              ) : (
                <p role="status" className="text-muted-foreground text-sm">
                  {m.webhooks_setup_help()}
                </p>
              )}
            </TabsContent>
            <TabsContent value="settings" className="max-w-2xl pt-4">
              <ProjectWebhook projectId={projectId} />
            </TabsContent>
          </Tabs>
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
