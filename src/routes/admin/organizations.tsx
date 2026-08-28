import { createFileRoute } from "@tanstack/react-router";
import {
  AdminOrganizationForm,
  AdminOrganizationsTable,
} from "@krak-stack/auth/components";
import { Plus } from "lucide-react";
import { Schema } from "effect";
import { useState } from "react";

import { Query, QueryStandard } from "@krak-stack/registry/query";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/organizations")({
  validateSearch: QueryStandard,
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
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
      <AdminOrganizationsTable
        reloadKey={reloadKey}
        search={search}
        onSearchChange={(nextSearch) =>
          void navigate({
            search: Schema.encodeSync(Query)(nextSearch),
          })
        }
      />
      {creatingOrganization ? (
        <AdminOrganizationForm
          onClose={() => setCreatingOrganization(false)}
          onSaved={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
    </>
  );
}
