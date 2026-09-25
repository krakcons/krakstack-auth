import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { Badge } from "@/components/ui/badge";

import { authClientApi } from "./auth-client-api.js";

const associatedProjectsAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((organizationId: string | null) =>
    authClientApi(baseUrl).query("authExtra", "listAssociatedProjects", {
      query: organizationId ? { organizationId } : {},
      timeToLive: "1 minute",
      reactivityKeys: [
        "associated-projects",
        organizationId ? `organization:${organizationId}` : "current-user",
      ],
    }),
  ),
);

export const AssociatedProjectsNotice = ({
  baseUrl,
  getSummary,
  organizationId = null,
  viewLabel,
}: {
  baseUrl?: string | undefined;
  getSummary: (count: number) => string;
  organizationId?: string | null;
  viewLabel: string;
}) => {
  const result = useAtomValue(associatedProjectsAtom(baseUrl)(organizationId));
  const projects = AsyncResult.match(result, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => Array.from(value),
  });

  if (projects.length <= 1) return null;

  return (
    <details className="border-primary/60 text-muted-foreground border-l-2 pl-3 text-sm">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {getSummary(projects.length)}{" "}
        <span className="text-foreground underline underline-offset-4">
          {viewLabel}
        </span>
      </summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {projects.map((project) => (
          <Badge key={project.id} variant="secondary">
            {project.name}
          </Badge>
        ))}
      </div>
    </details>
  );
};
