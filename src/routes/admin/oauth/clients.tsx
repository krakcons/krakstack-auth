import { createFileRoute } from "@tanstack/react-router";

import { TableSearchSchemaStandard as TableSearchSchema } from "@/components/data-table";
import { SidebarPageHeader } from "@/components/sidebar-layout";
import { m } from "@/paraglide/messages";
import { OAuthClientsTable } from "@/services/oauth/client/table";

export const Route = createFileRoute("/admin/oauth/clients")({
  validateSearch: TableSearchSchema,
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <>
      <SidebarPageHeader
        title={m.admin_clients_title()}
        description={m.admin_clients_description()}
        badge={{ label: m.admin_badge_oauth() }}
      />
      <OAuthClientsTable />
    </>
  );
}
