import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Building2, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage, useAppForm } from "@/components/ui/form";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminApiClient } from "@/lib/admin-api-client";
import { assetUrl } from "@/lib/assets";
import { m } from "@/paraglide/messages";
import { authBaseUrl } from "@/services/auth/client";
import type {
  ServerCreateDomainPayload,
  ServerDomain,
  ServerUpdateDomainPayload,
} from "@krak-stack/auth/server";

const domainsAtom = Atom.family((reloadKey: number) =>
  AdminApiClient.query("admin", "listDomains", {
    timeToLive: "1 minute",
    reactivityKeys: ["domains"],
    serializationKey: `domains:${reloadKey}`,
  }),
);

const deleteDomainAtom = AdminApiClient.mutation("admin", "deleteDomain");
const createDomainAtom = AdminApiClient.mutation("admin", "createDomain");
const updateDomainAtom = AdminApiClient.mutation("admin", "updateDomain");

export function DomainsTable({
  reloadKey = 0,
  creatingDomain = false,
  onCreatingDomainChange,
}: {
  reloadKey?: number;
  creatingDomain?: boolean;
  onCreatingDomainChange?: (open: boolean) => void;
}) {
  const result = useAtomValue(domainsAtom(reloadKey));
  const deleteDomain = useAtomSet(deleteDomainAtom, { mode: "promise" });
  const createDomain = useAtomSet(createDomainAtom, { mode: "promise" });
  const updateDomain = useAtomSet(updateDomainAtom, { mode: "promise" });
  const [domains, setDomains] = useState<ServerDomain[] | null>(null);
  const [editingDomain, setEditingDomain] = useState<ServerDomain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<ServerDomain | null>(
    null,
  );
  const rows =
    domains ??
    AsyncResult.match(result, {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: ({ value }) => Array.from(value),
    });
  const error = AsyncResult.match(result, {
    onInitial: () => "",
    onFailure: () => m.domain_fetch_error(),
    onSuccess: () => "",
  });

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columns={domainColumns()}
        data={rows}
        features={{
          export: { baseName: "domains" },
          gallery: false,
          rowActions: {
            items: [
              {
                name: m.admin_action_edit(),
                icon: <Pencil className="size-4" />,
                onClick: setEditingDomain,
              },
              {
                name: m.actions_delete(),
                icon: <Trash2 className="size-4" />,
                variant: "destructive",
                onClick: setDeletingDomain,
              },
            ],
          },
        }}
        routeFrom="/admin/domains"
      />
      {deletingDomain ? (
        <DeleteDomainDialog
          domain={deletingDomain}
          onClose={() => setDeletingDomain(null)}
          onDeleted={(deleted) => {
            setDomains((current) =>
              (current ?? rows).filter((domain) => domain.id !== deleted.id),
            );
          }}
          deleteDomain={deleteDomain}
        />
      ) : null}
      {editingDomain ? (
        <DomainDialog
          domain={editingDomain}
          onClose={() => setEditingDomain(null)}
          onSaved={(updated) => {
            setDomains((current) =>
              (current ?? rows).map((domain) =>
                domain.id === updated.id ? updated : domain,
              ),
            );
          }}
          saveDomain={(value) =>
            updateDomain({
              params: { id: editingDomain.id },
              payload: updateDomainPayloadFromValue(value),
              reactivityKeys: ["domains"],
            })
          }
        />
      ) : null}
      {creatingDomain ? (
        <DomainDialog
          onClose={() => onCreatingDomainChange?.(false)}
          onSaved={(created) => {
            setDomains((current) => [
              created,
              ...(current ?? rows).filter((domain) => domain.id !== created.id),
            ]);
          }}
          saveDomain={(value) =>
            createDomain({
              payload: createDomainPayloadFromValue(value),
              reactivityKeys: ["domains"],
            })
          }
        />
      ) : null}
    </div>
  );
}

type DomainFormValues = {
  hostname: string;
  rootHostname: string;
  projectId: string;
  organizationId: string;
  managed: boolean;
};

const createDomainPayloadFromValue = (
  value: DomainFormValues,
): ServerCreateDomainPayload => ({
  hostname: value.hostname.trim(),
  rootHostname: value.rootHostname.trim(),
  projectId: value.projectId.trim() || null,
  organizationId: value.organizationId.trim() || null,
  managed: value.managed,
});

const updateDomainPayloadFromValue = (
  value: DomainFormValues,
): ServerUpdateDomainPayload => ({
  hostname: value.hostname.trim(),
  rootHostname: value.rootHostname.trim(),
  projectId: value.projectId.trim() || null,
  organizationId: value.organizationId.trim() || null,
  managed: value.managed,
});

function DomainDialog({
  domain,
  onClose,
  onSaved,
  saveDomain,
}: {
  domain?: ServerDomain;
  onClose: () => void;
  onSaved: (domain: ServerDomain) => void;
  saveDomain: (value: DomainFormValues) => Promise<ServerDomain>;
}) {
  const isEditing = Boolean(domain);
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: {
      hostname: domain?.hostname ?? "",
      rootHostname: domain?.rootHostname ?? "",
      projectId: domain?.projectId ?? "",
      organizationId: domain?.organizationId ?? "",
      managed: domain?.managed ?? true,
    } satisfies DomainFormValues,
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const saved = await saveDomain(value);
        onSaved(saved);
        toast.success(
          isEditing ? m.domain_updated_toast() : m.domain_created_toast(),
        );
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : isEditing
              ? m.domain_update_error()
              : m.domain_create_error(),
        );
      }
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? m.domain_edit_title() : m.domain_create_title()}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? m.domain_edit_description()
              : m.domain_create_description()}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.AppForm>
            <form.AppField name="hostname">
              {(field) => (
                <field.TextField
                  label={m.domain_hostname()}
                  description={m.domain_hostname_description()}
                  disabled={isEditing && domain?.managed}
                  autoFocus
                />
              )}
            </form.AppField>
            <form.AppField name="rootHostname">
              {(field) => (
                <field.TextField
                  label={m.domain_root_hostname()}
                  description={m.domain_root_hostname_description()}
                />
              )}
            </form.AppField>
            <form.AppField name="projectId">
              {(field) => (
                <field.TextField
                  label={m.project()}
                  description={m.domain_project_id_description()}
                />
              )}
            </form.AppField>
            <form.AppField name="organizationId">
              {(field) => (
                <field.TextField
                  label={m.admin_column_organization()}
                  description={m.domain_organization_id_description()}
                />
              )}
            </form.AppField>
            <form.AppField name="managed">
              {(field) => (
                <field.CheckboxField
                  label={m.domain_managed()}
                  description={m.domain_managed_description()}
                />
              )}
            </form.AppField>
            {error ? <ErrorMessage text={error} /> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {m.actions_cancel()}
              </Button>
              <form.SubmitButton>
                {isEditing ? m.form_submit() : m.domain_create()}
              </form.SubmitButton>
            </div>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const domainColumns = (): ColumnDef<ServerDomain>[] => [
  {
    accessorKey: "hostname",
    header: m.domain_hostname(),
    cell: ({ row }) => (
      <code className="text-muted-foreground text-xs">
        {row.original.hostname}
      </code>
    ),
  },
  {
    accessorKey: "rootHostname",
    header: m.domain_root_hostname(),
    cell: ({ row }) => (
      <code className="text-muted-foreground text-xs">
        {row.original.rootHostname}
      </code>
    ),
  },
  {
    accessorKey: "active",
    header: m.admin_column_status(),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? m.admin_status_active() : m.domain_pending()}
      </Badge>
    ),
  },
  {
    accessorKey: "projectId",
    header: m.project(),
    cell: ({ row }) => {
      const logo = assetUrl(row.original.projectLogo ?? null, authBaseUrl);

      return row.original.projectId ? (
        <AppBrand
          to={null}
          label={row.original.projectName ?? row.original.projectId}
          subtitle={row.original.projectId}
          icon={FolderKanban}
          className="min-w-48"
          {...(logo ? { imageSrc: logo } : {})}
        />
      ) : (
        <span className="text-muted-foreground text-sm">{m.admin_none()}</span>
      );
    },
  },
  {
    accessorKey: "organizationId",
    header: m.admin_column_organization(),
    cell: ({ row }) => {
      const logo = assetUrl(row.original.organizationLogo ?? null, authBaseUrl);

      return row.original.organizationId ? (
        <AppBrand
          to={null}
          label={row.original.organizationName ?? row.original.organizationId}
          subtitle={row.original.organizationId}
          icon={Building2}
          className="min-w-48"
          {...(logo ? { imageSrc: logo } : {})}
        />
      ) : (
        <span className="text-muted-foreground text-sm">{m.admin_none()}</span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: m.admin_column_created(),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

function DeleteDomainDialog({
  domain,
  onClose,
  onDeleted,
  deleteDomain,
}: {
  domain: ServerDomain;
  onClose: () => void;
  onDeleted: (domain: ServerDomain) => void;
  deleteDomain: (input: {
    params: { id: string };
    reactivityKeys?: ReadonlyArray<string>;
  }) => Promise<ServerDomain>;
}) {
  const [error, setError] = useState("");

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.domain_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.domain_delete_description({ hostname: domain.hostname })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorMessage text={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{m.actions_cancel()}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              setError("");
              try {
                const deleted = await deleteDomain({
                  params: { id: domain.id },
                  reactivityKeys: ["domains"],
                });
                onDeleted(deleted);
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : m.domain_delete_error(),
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
