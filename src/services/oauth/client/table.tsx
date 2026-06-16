import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  createDataTableActionsColumn,
  DataTable,
} from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { m } from "@/paraglide/messages";
import { AdminApiClient } from "@/lib/admin-api-client";

import type { OAuthClientAdmin } from "../schema";
import { OAuthClientForm } from "./form";

const oauthClientsAtom = Atom.family((reloadKey: number) =>
  AdminApiClient.query("oauthClients", "listOAuthClients", {
    timeToLive: "1 minute",
    reactivityKeys: ["oauth-clients"],
    serializationKey: `oauth-clients:${reloadKey}`,
  }),
);

const deleteOAuthClientAtom = AdminApiClient.mutation(
  "oauthClients",
  "deleteOAuthClient",
);

export function OAuthClientsTable({ reloadKey = 0 }: { reloadKey?: number }) {
  const result = useAtomValue(oauthClientsAtom(reloadKey));
  const deleteOAuthClient = useAtomSet(deleteOAuthClientAtom, {
    mode: "promise",
  });
  const [clients, setClients] = useState<OAuthClientAdmin[] | null>(null);
  const [editingClient, setEditingClient] = useState<OAuthClientAdmin | null>(
    null,
  );
  const [deletingClient, setDeletingClient] = useState<OAuthClientAdmin | null>(
    null,
  );
  const rows =
    clients ??
    AsyncResult.match(result, {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: ({ value }) => Array.from(value),
    });
  const error = AsyncResult.match(result, {
    onInitial: () => "",
    onFailure: () => m.oauth_client_fetch_error(),
    onSuccess: () => "",
  });

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columns={clientColumns({
          onEdit: setEditingClient,
          onDelete: setDeletingClient,
        })}
        data={rows}
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
              (current ?? rows).map((client) =>
                client.clientId === updated.clientId ? updated : client,
              ),
            );
          }}
        />
      ) : null}
      {deletingClient ? (
        <DeleteOAuthClientDialog
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onDeleted={(deleted) => {
            setClients((current) =>
              (current ?? rows).filter(
                (client) => client.clientId !== deleted.clientId,
              ),
            );
          }}
          deleteOAuthClient={deleteOAuthClient}
        />
      ) : null}
    </div>
  );
}

const clientColumns = ({
  onEdit,
  onDelete,
}: {
  onEdit: (client: OAuthClientAdmin) => void;
  onDelete: (client: OAuthClientAdmin) => void;
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
    id: "project",
    header: m.project(),
    cell: ({ row }) => (
      <div className="flex min-w-48 items-center gap-3">
        {row.original.projectLogo ? (
          <img
            src={row.original.projectLogo}
            alt=""
            className="size-8 rounded-md border object-contain"
          />
        ) : (
          <div className="bg-muted size-8 rounded-md border" />
        )}
        <span className="truncate text-sm">
          {row.original.projectName ?? m.project_none()}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "redirectUris",
    header: m.admin_column_redirect_uris(),
    cell: ({ row }) => (
      <div className="flex max-w-80 flex-col gap-1">
        {row.original.redirectUris.length ? (
          row.original.redirectUris.map((uri) => (
            <code key={uri} className="text-muted-foreground truncate text-xs">
              {uri}
            </code>
          ))
        ) : (
          <span className="text-muted-foreground text-sm">
            {m.admin_none()}
          </span>
        )}
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
    {
      name: m.actions_delete(),
      icon: <Trash2 className="size-4" />,
      variant: "destructive",
      onClick: onDelete,
    },
  ]),
];

function DeleteOAuthClientDialog({
  client,
  onClose,
  onDeleted,
  deleteOAuthClient,
}: {
  client: OAuthClientAdmin;
  onClose: () => void;
  onDeleted: (client: OAuthClientAdmin) => void;
  deleteOAuthClient: (input: {
    params: { clientId: string };
    reactivityKeys?: ReadonlyArray<string>;
  }) => Promise<OAuthClientAdmin>;
}) {
  const [error, setError] = useState("");
  const name = client.name ?? client.clientId;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.admin_delete_client_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.admin_delete_client_description({ name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorMessage text={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            {m.form_block_navigation_cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              setError("");
              try {
                const deleted = await deleteOAuthClient({
                  params: { clientId: client.clientId },
                  reactivityKeys: ["oauth-clients"],
                });
                toast.success(m.admin_client_deleted_toast());
                onDeleted(deleted);
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : m.admin_error_delete_client(),
                );
              }
            }}
          >
            {m.actions_delete()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
