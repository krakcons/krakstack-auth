import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { TableSearchSchemaStandard as TableSearchSchema } from "@/components/ui/data-table";
import { SidebarPageHeader } from "@/components/ui/sidebar-layout";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { OrganizationForm } from "@/services/organizations/client/form";
import { OrganizationsTable } from "@/services/organizations/client/table";

export const Route = createFileRoute("/admin/organizations")({
  validateSearch: TableSearchSchema,
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <SidebarPageHeader
        title={m.admin_organizations_title()}
        description={m.admin_organizations_description()}
        badge={{ label: m.admin_badge_admin() }}
        actions={
          <Button onClick={() => setCreatingOrganization(true)}>
            <Plus data-icon="inline-start" />
            {m.admin_create_organization()}
          </Button>
        }
      />
      <OrganizationsTable reloadKey={reloadKey} />
      {creatingOrganization ? (
        <OrganizationForm
          onClose={() => setCreatingOrganization(false)}
          onSaved={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
    </>
  );
}
