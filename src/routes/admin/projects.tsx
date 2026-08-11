import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { TableSearchSchemaStandard as TableSearchSchema } from "@krak-stack/registry/data-table";
import { Button } from "@/components/ui/button";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { m } from "@/paraglide/messages";
import { ProjectForm } from "@/services/projects/client/form";
import { ProjectsTable } from "@/services/projects/client/table";

export const Route = createFileRoute("/admin/projects")({
  validateSearch: TableSearchSchema,
  component: ProjectsPage,
});

function ProjectsPage() {
  const [creatingProject, setCreatingProject] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <SidebarPageHeader
        title={m.projects_title()}
        description={m.projects_description()}
        badge={{ label: m.admin_badge_admin() }}
        actions={
          <Button onClick={() => setCreatingProject(true)}>
            <Plus data-icon="inline-start" />
            {m.project_create()}
          </Button>
        }
      />
      <ProjectsTable reloadKey={reloadKey} />
      {creatingProject ? (
        <ProjectForm
          onClose={() => setCreatingProject(false)}
          onSaved={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
    </>
  );
}
