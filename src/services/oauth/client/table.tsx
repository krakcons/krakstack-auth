import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { FolderKanban, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DataTable,
  type DataTableColDef,
} from "@krak-stack/registry/data-table";
import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { AppBrand } from "@krak-stack/registry/app-brand";
import { Query } from "@krak-stack/registry/query";
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
import { assetUrl } from "@/lib/assets";
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

export function OAuthClientsTable({ reloadKey = 0 }: { reloadKey?: number }) {
  const navigate = useNavigate({ from: "/admin/oauth/clients" });
  const search = useSearch({ from: "/admin/oauth/clients" });
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
        columnDefs={clientColumns()}
        rowData={rows}
        features={{
          export: { baseName: "oauth-clients" },
          gallery: false,
          rowActions: {
            items: [
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
            ],
          },
        }}
        initialState={search}
        onStateChange={(state) =>
          void navigate({
            search: Schema.encodeSync(Query)(state),
          })
        }
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

const clientColumns = (): DataTableColDef<OAuthClientAdmin>[] => [
  {
    field: "name",
    headerName: m.admin_column_client(),
    cellRenderer: ({ data }) => {
      const icon = assetUrl(data.icon, authBaseUrl);

      return (
        <AppBrand
          to={null}
          label={data.name ?? data.clientId}
          subtitle={data.clientId}
          icon={KeyRound}
          className="min-w-56"
          {...(icon ? { imageSrc: icon } : {})}
        />
      );
    },
  },
  {
    colId: "project",
    headerName: m.project(),
    cellRenderer: ({ data }) => {
      const logo = assetUrl(data.projectLogo, authBaseUrl);

      return (
        <AppBrand
          to={null}
          label={data.projectName ?? m.project_none()}
          subtitle={data.projectId ?? ""}
          icon={FolderKanban}
          className="min-w-48"
          {...(logo ? { imageSrc: logo } : {})}
        />
      );
    },
  },
  {
    field: "redirectUris",
    headerName: m.admin_column_redirect_uris(),
    cellRenderer: ({ data }) => (
      <div className="flex max-w-80 flex-col gap-1">
        {data.redirectUris.length ? (
          data.redirectUris.map((uri) => (
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
    field: "scope",
    headerName: m.admin_column_scopes(),
    cellRenderer: ({ data }) => (
      <code className="text-muted-foreground text-xs">
        {data.scope ?? m.admin_none()}
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
