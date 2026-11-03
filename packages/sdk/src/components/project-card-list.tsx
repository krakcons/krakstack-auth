import { AppWindow } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const ProjectCardList = ({
  projects,
}: {
  projects: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}) => (
  <ul className="grid gap-2 sm:grid-cols-2">
    {projects.map((project) => (
      <li key={project.id}>
        <Card size="sm" className="h-full py-3 shadow-none">
          <CardContent className="flex items-center gap-3 px-3">
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <AppWindow aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium break-words">
              {project.name}
            </span>
          </CardContent>
        </Card>
      </li>
    ))}
  </ul>
);
