import { createFileRoute } from "@tanstack/react-router";
import { QueryStandard } from "@krak-stack/registry/query";
import { useState } from "react";
import { DomainsTable } from "@/services/domains/client/table";

export const Route = createFileRoute("/admin/projects/$projectId/domains")({
  validateSearch: QueryStandard,
  component: ProjectDomains,
});

function ProjectDomains() {
  const { projectId } = Route.useParams();
  const query = Route.useSearch();
  const navigate = Route.useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <DomainsTable
        key={projectId}
        projectId={projectId}
        query={query}
        onStateChange={(search) => void navigate({ search })}
        creatingDomain={creating}
        onCreatingDomainChange={setCreating}
      />
    </div>
  );
}
