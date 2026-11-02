import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { Atom, AsyncResult } from "effect/reactivity";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  DataTable,
  type DataTableColDef,
} from "@krak-stack/registry/data-table";
import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { Query } from "@krak-stack/registry/query";
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
} from "@/components/ui/menubar";
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

export function OAuthClientsTable({
  reloadKey = 0,
  projectId,
  query,
  onStateChange,
  onCreate,
  onAssign,
}: {
  reloadKey?: number;
  projectId?: string;
  query: typeof Query.Type;
  onStateChange: (query: typeof Query.Encoded) => void;
  onCreate: () => void;
  onAssign?: (client: OAuthClientAdmin) => void;
}) {
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
  const allRows =
    clients ??
    AsyncResult.match(result, {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: ({ value }) => Array.from(value),
    });
  const rows = projectId
    ? allRows.filter((client) => client.projectId === projectId)
    : allRows;
  const unassignedClients = AsyncResult.getOrElse(result, () => []).filter(
    (client) => client.projectId === null,
  );
  const error = AsyncResult.match(result, {
    onInitial: () => "",
    onFailure: () => m.oauth_client_fetch_error(),
    onSuccess: () => "",
  });

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columnDefs={clientColumns(!projectId)}
        rowData={rows}
        features={{
          toolbar: {
            items: (
              <MenubarMenu>
                <MenubarTrigger>{m.actions_title()}</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem onClick={onCreate}>
                    <Plus />
                    {m.admin_create_client()}
                  </MenubarItem>
                  {onAssign ? (
                    <MenubarSub>
                      <MenubarSubTrigger>
                        {m.oauth_client_assign_existing()}
                      </MenubarSubTrigger>
                      <MenubarSubContent>
                        {unassignedClients.length ? (
                          unassignedClients.map((client) => (
                            <MenubarItem
                              key={client.clientId}
                              onClick={() => onAssign(client)}
                            >
                              {client.name ?? client.clientId}
                            </MenubarItem>
                          ))
                        ) : (
                          <MenubarItem disabled>
                            {m.oauth_client_no_unassigned()}
                          </MenubarItem>
                        )}
                      </MenubarSubContent>
                    </MenubarSub>
                  ) : null}
                </MenubarContent>
              </MenubarMenu>
            ),
          },
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
        initialState={query}
        onStateChange={(state) =>
          onStateChange(Schema.encodeSync(Query)(state))
        }
      />
      {editingClient ? (
        <OAuthClientForm
          client={editingClient}
          projectId={projectId}
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

const clientColumns = (
  showProject: boolean,
): DataTableColDef<OAuthClientAdmin>[] => [
  {
    field: "name",
    headerName: m.admin_column_client(),
    type: "reference",
    typeOptions: {
      imageVariant: "square",
      getItem: (data) => ({
        label: data.name ?? data.clientId,
        description: data.clientId,
        imageSrc: assetUrl(data.icon, authBaseUrl),
      }),
    },
  },
  ...projectColumns(showProject),
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

const projectColumns = (
  showProject: boolean,
): DataTableColDef<OAuthClientAdmin>[] =>
  showProject
    ? [
        {
          colId: "project",
          headerName: m.project(),
          type: "reference",
          typeOptions: {
            imageVariant: "square",
            getItem: (data) => ({
              label: data.projectName ?? m.project_none(),
              description: data.projectId,
              imageSrc: assetUrl(data.projectLogo, authBaseUrl),
            }),
          },
        },
      ]
    : [];

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
