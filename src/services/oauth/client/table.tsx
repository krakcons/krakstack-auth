import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { FolderKanban, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import { AppBrand } from "@/components/ui/app-brand";
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
import { authBaseUrl } from "@/services/auth/client";

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

const assetUrl = (value: string | null | undefined) => {
  const url = value?.trim();
  if (!url) return "";
  if (!url.startsWith("/api/assets/") && !url.startsWith("/api/auth/assets/"))
    return url;
  if (!authBaseUrl?.trim()) return url;

  return new URL(url, authBaseUrl).toString();
};

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
        columns={clientColumns()}
        data={rows}
        exportFileName="oauth-clients.csv"
        features={{ gallery: false }}
        from="/admin/oauth/clients"
        rowActions={[
          {
            name: m.admin_action_edit(),
            icon: <Pencil className="size-4" />,
            onClick: setEditingClient,
          },
          {
            name: m.actions_delete(),
            icon: <Trash2 className="size-4" />,
            variant: "destructive",
            onClick: setDeletingClient,
          },
        ]}
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

const clientColumns = (): ColumnDef<OAuthClientAdmin>[] => [
  {
    accessorKey: "name",
    header: m.admin_column_client(),
    cell: ({ row }) => {
      const icon = assetUrl(row.original.icon);

      return (
        <AppBrand
          to={null}
          label={row.original.name ?? row.original.clientId}
          subtitle={row.original.clientId}
          icon={KeyRound}
          className="min-w-56"
          {...(icon ? { imageSrc: icon } : {})}
        />
      );
    },
  },
  {
    id: "project",
    header: m.project(),
    cell: ({ row }) => {
      const logo = assetUrl(row.original.projectLogo);

      return (
        <AppBrand
          to={null}
          label={row.original.projectName ?? m.project_none()}
          subtitle={row.original.projectId ?? ""}
          icon={FolderKanban}
          className="min-w-48"
          {...(logo ? { imageSrc: logo } : {})}
        />
      );
    },
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
