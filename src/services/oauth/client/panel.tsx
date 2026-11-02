import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { OAuthClientAdmin } from "../schema";

import type { Query } from "@krak-stack/registry/query";
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

export function OAuthClientsPanel({
  projectId,
  query,
  onStateChange,
}: {
  projectId?: string;
  query: typeof Query.Type;
  onStateChange: (query: typeof Query.Encoded) => void;
}) {
  const [creatingClient, setCreatingClient] = useState(false);
  const [createdClient, setCreatedClient] =
    useState<OAuthClientFormSaved | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [assigningClient, setAssigningClient] =
    useState<OAuthClientAdmin | null>(null);

  return (
    <>
      <OAuthClientsTable
        key={reloadKey}
        projectId={projectId}
        query={query}
        onStateChange={onStateChange}
        reloadKey={reloadKey}
        onCreate={() => setCreatingClient(true)}
        onAssign={projectId ? setAssigningClient : undefined}
      />
      {creatingClient ? (
        <OAuthClientForm
          projectId={projectId}
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
      {assigningClient ? (
        <OAuthClientForm
          client={assigningClient}
          projectId={projectId}
          onClose={() => setAssigningClient(null)}
          onSaved={() => setReloadKey((current) => current + 1)}
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
