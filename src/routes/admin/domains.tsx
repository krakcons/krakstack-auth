import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { QueryStandard } from "@krak-stack/registry/query";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { m } from "@/paraglide/messages";
import { DomainsTable } from "@/services/domains/client/table";

export const Route = createFileRoute("/admin/domains")({
  validateSearch: QueryStandard,
  component: DomainsPage,
});

function DomainsPage() {
  const query = Route.useSearch();
  const navigate = Route.useNavigate();
  const [creatingDomain, setCreatingDomain] = useState(false);

  return (
    <>
      <SidebarPageHeader
        title={m.domains_title()}
        description={m.domains_description()}
        badge={{ label: m.admin_badge_admin() }}
      />
      <DomainsTable
        query={query}
        onStateChange={(search) => void navigate({ search })}
        creatingDomain={creatingDomain}
        onCreatingDomainChange={setCreatingDomain}
      />
    </>
  );
}
