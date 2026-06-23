import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TableSearchSchemaStandard as TableSearchSchema } from "@/components/ui/data-table";
import { SidebarPageHeader } from "@/components/ui/sidebar-layout";
import { m } from "@/paraglide/messages";
import { DomainsTable } from "@/services/domains/client/table";

export const Route = createFileRoute("/admin/domains")({
  validateSearch: TableSearchSchema,
  component: DomainsPage,
});

function DomainsPage() {
  const [creatingDomain, setCreatingDomain] = useState(false);

  return (
    <>
      <SidebarPageHeader
        title={m.domains_title()}
        description={m.domains_description()}
        badge={{ label: m.admin_badge_admin() }}
        actions={
          <Button onClick={() => setCreatingDomain(true)}>
            <Plus className="size-4" />
            {m.domain_create()}
          </Button>
        }
      />
      <DomainsTable
        creatingDomain={creatingDomain}
        onCreatingDomainChange={setCreatingDomain}
      />
    </>
  );
}
