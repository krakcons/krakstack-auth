import { type ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createDataTableActionsColumn,
  DataTable,
} from "@/components/data-table";
import { ErrorMessage } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

import type { OAuthClientAdmin } from "../schema";
import { OAuthClientForm } from "./form";

const listOAuthClients = async () => {
  const response = await fetch("/api/oauth/clients");
  if (!response.ok) throw new Error(m.oauth_client_fetch_error());
  return (await response.json()) as OAuthClientAdmin[];
};

export function OAuthClientsTable({ reloadKey = 0 }: { reloadKey?: number }) {
  const [clients, setClients] = useState<OAuthClientAdmin[]>([]);
  const [editingClient, setEditingClient] = useState<OAuthClientAdmin | null>(
    null,
  );
  const [error, setError] = useState("");

  const loadClients = async () => {
    setError("");
    try {
      setClients(await listOAuthClients());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : m.oauth_client_fetch_error(),
      );
    }
  };

  useEffect(() => {
    void loadClients();
  }, [reloadKey]);

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columns={clientColumns({ onEdit: setEditingClient })}
        data={clients}
        exportFileName="oauth-clients.csv"
        features={{ gallery: false }}
        from="/admin/oauth/clients"
      />
      {editingClient ? (
        <OAuthClientForm
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={(updated) => {
            setClients((current) =>
              current.map((client) =>
                client.clientId === updated.clientId ? updated : client,
              ),
            );
          }}
        />
      ) : null}
    </div>
  );
}

const clientColumns = ({
  onEdit,
}: {
  onEdit: (client: OAuthClientAdmin) => void;
}): ColumnDef<OAuthClientAdmin>[] => [
  {
    accessorKey: "name",
    header: m.admin_column_client(),
    cell: ({ row }) => (
      <div className="flex min-w-56 items-center gap-3">
        {row.original.icon ? (
          <img
            src={row.original.icon}
            alt=""
            className="size-9 rounded-md border object-contain"
          />
        ) : (
          <div className="bg-muted size-9 rounded-md border" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">
            {row.original.name ?? row.original.clientId}
          </span>
          <code className="text-muted-foreground truncate text-xs">
            {row.original.clientId}
          </code>
        </div>
      </div>
    ),
  },
  {
    id: "authOptions",
    header: m.oauth_client_auth_options(),
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {row.original.metadata.authOptions?.emailPassword !== false ? (
          <Badge variant="secondary">
            {m.oauth_client_auth_email_password()}
          </Badge>
        ) : null}
        {row.original.metadata.authOptions?.google !== false ? (
          <Badge variant="secondary">{m.oauth_client_auth_google()}</Badge>
        ) : null}
        {row.original.metadata.authOptions?.signUp !== false ? (
          <Badge variant="outline">{m.oauth_client_auth_sign_up()}</Badge>
        ) : null}
        {row.original.metadata.authOptions?.signUpName !== false ? (
          <Badge variant="outline">{m.oauth_client_auth_sign_up_name()}</Badge>
        ) : null}
      </div>
    ),
  },
  {
    id: "branding",
    header: m.oauth_client_branding(),
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {row.original.icon ? (
          <Badge variant="outline">{m.oauth_client_logo_configured()}</Badge>
        ) : null}
        {row.original.metadata.branding?.themeCss ? (
          <Badge variant="outline">{m.oauth_client_theme_configured()}</Badge>
        ) : null}
        {!row.original.icon && !row.original.metadata.branding?.themeCss ? (
          <span className="text-muted-foreground text-sm">
            {m.admin_none()}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "scope",
    header: m.admin_column_scopes(),
    cell: ({ row }) => (
      <code className="text-muted-foreground text-xs">
        {row.original.scope ?? m.admin_none()}
      </code>
    ),
  },
  createDataTableActionsColumn<OAuthClientAdmin>([
    {
      name: m.admin_action_edit(),
      icon: <Pencil className="size-4" />,
      onClick: onEdit,
    },
  ]),
];
