import { useAtomValue } from "@effect/atom-react";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import {
  Globe2,
  KeyRound,
  LayoutDashboard,
  Settings,
  Webhook,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AsyncResult } from "effect/reactivity";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { m } from "@/paraglide/messages";
import { projectsAtom } from "@/services/projects/client/atom";

export const Route = createFileRoute("/admin/projects/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const pathname = useLocation({ select: (location) => location.pathname });
  const tab = pathname.endsWith("/settings")
    ? "settings"
    : pathname.endsWith("/domains")
      ? "domains"
      : pathname.endsWith("/webhooks")
        ? "webhooks"
        : pathname.endsWith("/oauth-clients")
          ? "oauth-clients"
          : "dashboard";
  const result = useAtomValue(projectsAtom);
  const project = AsyncResult.getOrElse(result, () => []).find(
    (item) => item.id === projectId,
  );
  if (!project)
    return (
      <p role="status">
        {AsyncResult.isFailure(result)
          ? m.project_fetch_error()
          : AsyncResult.isInitial(result)
            ? m.webhooks_loading()
            : m.webhooks_project_unavailable()}
      </p>
    );

  return (
    <>
      <SidebarPageHeader title={project.name} description={project.id} />
      <Tabs value={tab}>
        <div className="mt-2 w-full border-b">
          <div className="-mx-1 scroll-px-1 overflow-x-auto overflow-y-hidden px-1">
            <TabsList
              variant="line"
              className="min-w-max px-0"
              aria-label={m.project_navigation()}
            >
              <TabsTrigger
                value="dashboard"
                nativeButton={false}
                render={
                  <Link
                    to="/admin/projects/$projectId"
                    params={{ projectId }}
                  />
                }
              >
                <LayoutDashboard />
                {m.admin_dashboard()}
              </TabsTrigger>
              <TabsTrigger
                value="domains"
                nativeButton={false}
                render={
                  <Link
                    to="/admin/projects/$projectId/domains"
                    params={{ projectId }}
                  />
                }
              >
                <Globe2 />
                {m.domains_title()}
              </TabsTrigger>
              <TabsTrigger
                value="webhooks"
                nativeButton={false}
                render={
                  <Link
                    to="/admin/projects/$projectId/webhooks"
                    params={{ projectId }}
                  />
                }
              >
                <Webhook />
                {m.project_webhook_title()}
              </TabsTrigger>
              <TabsTrigger
                value="oauth-clients"
                nativeButton={false}
                render={
                  <Link
                    to="/admin/projects/$projectId/oauth-clients"
                    params={{ projectId }}
                  />
                }
              >
                <KeyRound />
                {m.admin_oauth_clients()}
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                nativeButton={false}
                render={
                  <Link
                    to="/admin/projects/$projectId/settings"
                    params={{ projectId }}
                  />
                }
              >
                <Settings />
                {m.webhooks_settings()}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </Tabs>
      <Outlet />
    </>
  );
}
