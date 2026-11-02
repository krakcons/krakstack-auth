import { createFileRoute } from "@tanstack/react-router";
import { QueryStandard } from "@krak-stack/registry/query";
import { OAuthClientsPanel } from "@/services/oauth/client/panel";

export const Route = createFileRoute(
  "/admin/projects/$projectId/oauth-clients",
)({
  validateSearch: QueryStandard,
  component: ProjectOAuthClients,
});

function ProjectOAuthClients() {
  const { projectId } = Route.useParams();
  const query = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <OAuthClientsPanel
      key={projectId}
      projectId={projectId}
      query={query}
      onStateChange={(search) => void navigate({ search })}
    />
  );
}
