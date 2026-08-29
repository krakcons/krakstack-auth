import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Plus } from "lucide-react";
import { useState } from "react";

import { QueryStandard } from "@krak-stack/registry/query";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";
import {
  OAuthClientForm,
  type OAuthClientFormSaved,
} from "@/services/oauth/client/form";
import { OAuthClientsTable } from "@/services/oauth/client/table";

export const Route = createFileRoute("/admin/oauth/clients")({
  validateSearch: QueryStandard,
  component: ClientsPage,
});

function ClientsPage() {
  const [creatingClient, setCreatingClient] = useState(false);
  const [createdClient, setCreatedClient] =
    useState<OAuthClientFormSaved | null>(null);
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
          onSaved={(client) => {
            setReloadKey((current) => current + 1);
            setCreatedClient(client);
          }}
        />
      ) : null}
      {createdClient && "clientSecret" in createdClient ? (
        <OAuthClientCredentialsDialog
          client={createdClient}
          onClose={() => setCreatedClient(null)}
        />
      ) : null}
    </>
  );
}

function OAuthClientCredentialsDialog({
  client,
  onClose,
}: {
  client: OAuthClientFormSaved & { clientSecret: string };
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.admin_client_credentials_title()}</DialogTitle>
          <DialogDescription>
            {m.admin_client_credentials_description()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <CredentialField
            label={m.admin_client_id_label()}
            copyLabel={m.admin_copy_client_id()}
            value={client.clientId}
          />
          <CredentialField
            label={m.admin_client_secret_label()}
            copyLabel={m.admin_copy_client_secret()}
            value={client.clientSecret}
          />
          <p className="text-muted-foreground text-sm">
            {m.admin_client_secret_warning()}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CredentialField({
  label,
  copyLabel,
  value,
}: {
  label: string;
  copyLabel: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded-md px-3 py-2 text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigator.clipboard
              .writeText(value)
              .then(() => setCopied(true))
          }
        >
          {copied ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? m.admin_client_copied() : copyLabel}
        </Button>
      </div>
      <span className="sr-only" role="status">
        {copied ? m.admin_client_copied() : ""}
      </span>
    </div>
  );
}
