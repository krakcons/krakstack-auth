import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Effect, Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Building2, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColDef,
} from "@krak-stack/registry/data-table";
import {
  CheckboxField,
  ErrorMessage,
  SubmitButton,
  SubmitError,
  TextField,
} from "@krak-stack/registry/effect-form";
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
  const navigate = useNavigate({ from: "/admin/domains" });
  const search = useSearch({ from: "/admin/domains" });
  const result = useAtomValue(domainsAtom(reloadKey));
  const deleteDomain = useAtomSet(deleteDomainAtom, { mode: "promise" });
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
        columnDefs={domainColumns()}
        rowData={rows}
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
        initialState={search}
        onStateChange={(state) =>
          void navigate({
            search: Schema.encodeSync(Query)(state),
          })
        }
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

const domainFormBuilder = FormBuilder.empty
  .addField("hostname", Schema.String)
  .addField("rootHostname", Schema.String)
  .addField("projectId", Schema.String)
  .addField("organizationId", Schema.String)
  .addField("managed", Schema.Boolean);

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

const makeDomainForm = (domain?: ServerDomain) =>
  FormReact.make(domainFormBuilder, {
    fields: {
      hostname: TextField,
      rootHostname: TextField,
      projectId: TextField,
      organizationId: TextField,
      managed: CheckboxField,
    },
    onSubmit: (_, { decoded: value, get }) =>
      domain
        ? get
            .setResult(updateDomainAtom, {
              params: { id: domain.id },
              payload: updateDomainPayloadFromValue(value),
              reactivityKeys: ["domains"],
            })
            .pipe(
              Effect.mapError((cause) =>
                cause instanceof Error ? cause : new Error(String(cause)),
              ),
            )
        : get
            .setResult(createDomainAtom, {
              payload: createDomainPayloadFromValue(value),
              reactivityKeys: ["domains"],
            })
            .pipe(
              Effect.mapError((cause) =>
                cause instanceof Error ? cause : new Error(String(cause)),
              ),
            ),
  });

function DomainDialog({
  domain,
  onClose,
  onSaved,
}: {
  domain?: ServerDomain;
  onClose: () => void;
  onSaved: (domain: ServerDomain) => void;
}) {
  const isEditing = Boolean(domain);
  const [form] = useState(() => makeDomainForm(domain));
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  useAtomSubscribe(form.submit, (result) => {
    if (!AsyncResult.isSuccess(result)) return;
    onSaved(result.value);
    onClose();
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
        <form.Initialize
          defaultValues={{
            hostname: domain?.hostname ?? "",
            rootHostname: domain?.rootHostname ?? "",
            projectId: domain?.projectId ?? "",
            organizationId: domain?.organizationId ?? "",
            managed: domain?.managed ?? true,
          }}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <form.hostname
              label={m.domain_hostname()}
              description={m.domain_hostname_description()}
              disabled={isEditing && domain?.managed}
              autoFocus
            />
            <form.rootHostname
              label={m.domain_root_hostname()}
              description={m.domain_root_hostname_description()}
            />
            <form.projectId
              label={m.project()}
              description={m.domain_project_id_description()}
            />
            <form.organizationId
              label={m.admin_column_organization()}
              description={m.domain_organization_id_description()}
            />
            <form.managed
              label={m.domain_managed()}
              description={m.domain_managed_description()}
            />
            <SubmitError result={submitResult} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {m.actions_cancel()}
              </Button>
              <SubmitButton form={form}>
                {isEditing ? m.form_submit() : m.domain_create()}
              </SubmitButton>
            </div>
          </form>
        </form.Initialize>
      </DialogContent>
    </Dialog>
  );
}

const domainColumns = (): DataTableColDef<ServerDomain>[] => [
  {
    field: "hostname",
    headerName: m.domain_hostname(),
    cellRenderer: ({ data }) => (
      <code className="text-muted-foreground text-xs">{data.hostname}</code>
    ),
  },
  {
    field: "rootHostname",
    headerName: m.domain_root_hostname(),
    cellRenderer: ({ data }) => (
      <code className="text-muted-foreground text-xs">{data.rootHostname}</code>
    ),
  },
  {
    field: "active",
    headerName: m.admin_column_status(),
    cellRenderer: ({ data }) => (
      <Badge variant={data.active ? "default" : "secondary"}>
        {data.active ? m.admin_status_active() : m.domain_pending()}
      </Badge>
    ),
  },
  {
    field: "projectId",
    headerName: m.project(),
    cellRenderer: ({ data }) => {
      const logo = assetUrl(data.projectLogo ?? null, authBaseUrl);

      return data.projectId ? (
        <AppBrand
          to={null}
          label={data.projectName ?? data.projectId}
          subtitle={data.projectId}
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
    field: "organizationId",
    headerName: m.admin_column_organization(),
    cellRenderer: ({ data }) => {
      const logo = assetUrl(data.organizationLogo ?? null, authBaseUrl);

      return data.organizationId ? (
        <AppBrand
          to={null}
          label={data.organizationName ?? data.organizationId}
          subtitle={data.organizationId}
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
    field: "createdAt",
    headerName: m.admin_column_created(),
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(data.createdAt).toLocaleDateString()}
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
