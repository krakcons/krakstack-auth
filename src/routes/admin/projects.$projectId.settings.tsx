import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { projectsAtom } from "@/services/projects/client/atom";
import { ProjectForm } from "@/services/projects/client/form";
import { ProjectWebhook } from "@/services/projects/client/webhook";
import { Separator } from "@/components/ui/separator";

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
    <div className="flex max-w-3xl flex-col gap-6">
      <ProjectForm key={projectId} project={project} inline />
      <Separator />
      <section id="webhooks" className="scroll-mt-6">
        <ProjectWebhook key={projectId} projectId={projectId} />
      </section>
    </div>
  ) : null;
}
