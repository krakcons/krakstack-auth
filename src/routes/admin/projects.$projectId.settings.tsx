import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { projectsAtom } from "@/services/projects/client/atom";
import { ProjectForm } from "@/services/projects/client/form";
import { ProjectWebhook } from "@/services/projects/client/webhook";
import { Separator } from "@/components/ui/separator";
import { ProjectEmailEditor } from "@/services/projects/client/email";
import { ProjectMcpSettings } from "@/services/project-mcp/client/form";

export const Route = createFileRoute("/admin/projects/$projectId/settings")({
  component: ProjectSettings,
});

function ProjectSettings() {
  const { projectId } = Route.useParams();
  const result = useAtomValue(projectsAtom);
  const project = AsyncResult.getOrElse(result, () => []).find(
    (item) => item.id === projectId,
  );
  return project ? (
    <div className="flex w-full max-w-7xl min-w-0 flex-col gap-6">
      <div id="project-details" className="max-w-3xl scroll-mt-6">
        <ProjectForm key={projectId} project={project} inline />
      </div>
      <Separator />
      <ProjectEmailEditor key={`email-${projectId}`} project={project} />
      <Separator />
      <section id="webhooks" className="max-w-3xl scroll-mt-6">
        <ProjectWebhook key={projectId} projectId={projectId} />
      </section>
      <Separator />
      <section id="mcp" className="max-w-3xl scroll-mt-6">
        <ProjectMcpSettings key={projectId} projectId={projectId} />
      </section>
    </div>
  ) : null;
}
