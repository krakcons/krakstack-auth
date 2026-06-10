import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { TableSearchSchemaStandard as TableSearchSchema } from "@/components/data-table";
import { SidebarPageHeader } from "@/components/sidebar-layout";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { OAuthClientForm } from "@/services/oauth/client/form";
import { OAuthClientsTable } from "@/services/oauth/client/table";

export const Route = createFileRoute("/admin/oauth/clients")({
  validateSearch: TableSearchSchema,
  component: ClientsPage,
});

function ClientsPage() {
  const [creatingClient, setCreatingClient] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <SidebarPageHeader
        title={m.admin_clients_title()}
        description={m.admin_clients_description()}
        badge={{ label: m.admin_badge_oauth() }}
        actions={
          <Button onClick={() => setCreatingClient(true)}>
            <Plus data-icon="inline-start" />
            {m.admin_create_client()}
          </Button>
        }
      />
      <OAuthClientsTable reloadKey={reloadKey} />
      {creatingClient ? (
        <OAuthClientForm
          onClose={() => setCreatingClient(false)}
          onSaved={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
    </>
  );
}
