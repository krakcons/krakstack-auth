import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import type { ValidateFromPath } from "@tanstack/react-router";
import { Cause, Effect, Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DataTable,
  type DataTableColumnDef,
  DataTableListSummary,
  type TableParams,
} from "@krak-stack/registry/data-table";
import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { AppBrand } from "@krak-stack/registry/app-brand";
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

import type { AdminOrganization } from "../admin/schema.js";
import { AdminOrganizationForm } from "./admin-organization-form.js";
import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider.js";
import { assetUrl, organizationBranding } from "./utils.js";

const defaultMessages = {
  en: {
    admin_column_created: "Created",
    admin_column_id: "ID",
    admin_column_members: "Members",
    admin_column_organization: "Organization",
    admin_column_projects: "Projects",
    organization_action_delete: "Delete organization",
    organization_action_edit: "Edit organization",
    organization_delete_cancel: "Cancel",
    organization_delete_confirm: "Delete",
    organization_delete_description:
      "Are you sure you want to delete {name}? This action cannot be undone.",
    organization_delete_error: "Unable to delete organization.",
    organization_delete_title: "Delete organization",
    organization_deleted_toast: "Organization deleted.",
    organization_fetch_error: "Unable to load organizations.",
  },
  fr: {
    admin_column_created: "Créé",
    admin_column_id: "ID",
    admin_column_members: "Membres",
    admin_column_organization: "Organisation",
    admin_column_projects: "Projets",
    organization_action_delete: "Supprimer l'organisation",
    organization_action_edit: "Modifier l'organisation",
    organization_delete_cancel: "Annuler",
    organization_delete_confirm: "Supprimer",
    organization_delete_description:
      "Êtes-vous sûr de vouloir supprimer {name} ? Cette action est irréversible.",
    organization_delete_error: "Impossible de supprimer l'organisation.",
    organization_delete_title: "Supprimer l'organisation",
    organization_deleted_toast: "Organisation supprimée.",
    organization_fetch_error: "Impossible de charger les organisations.",
  },
} as const;

const labels = (locale: KrakstackAuthLocale) => ({
  ...defaultMessages[locale],
});

type AdminOrganizationsLabels = ReturnType<typeof labels>;

const organizationDisplay = (
  organization: AdminOrganization,
  locale: KrakstackAuthLocale,
  baseUrl?: string | undefined,
) => {
  const branding = organizationBranding(organization, locale);

  return {
    name: branding?.name ?? organization.name,
    image: assetUrl(branding?.logo, baseUrl),
  };
};

interface AdminOrganizationsQuery {
  page: number;
  pageSize: number;
  globalFilter?: string;
  sort?: string;
  projectId?: string;
}

const AdminOrganizationsFamilyKey = Schema.fromJsonString(
  Schema.Struct({
    query: Schema.Struct({
      page: Schema.Number,
      pageSize: Schema.Number,
      globalFilter: Schema.optional(Schema.String),
      sort: Schema.optional(Schema.String),
      projectId: Schema.optional(Schema.String),
    }),
    reloadKey: Schema.Number,
  }),
).annotate({ identifier: "AdminOrganizationsFamilyKey" });

const organizationsQuery = (search: TableParams, projectId?: string | null) => {
  let query: AdminOrganizationsQuery = {
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 10,
  };
  if (search.globalFilter)
    query = { ...query, globalFilter: search.globalFilter };
  if (search.sort) query = { ...query, sort: search.sort };
  if (projectId) query = { ...query, projectId };

  return query;
};

const adminOrganizationsFamilyKey = (
  search: TableParams,
  projectId: string | null | undefined,
  reloadKey: number,
) =>
  JSON.stringify({
    query: organizationsQuery(search, projectId),
    reloadKey,
  });

const organizationsAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((key: string) => {
    const { query, reloadKey } = Schema.decodeUnknownSync(
      AdminOrganizationsFamilyKey,
    )(key);
    return authClientApi(baseUrl).query("admin", "listOrganizations", {
      query,
      timeToLive: "1 minute",
      reactivityKeys: [
        "organizations",
        ...(query.projectId ? [`project:${query.projectId}`] : []),
      ],
      serializationKey: `organizations:${reloadKey}:${JSON.stringify(query)}`,
    });
  }),
);

export function AdminOrganizationsTable({
  from,
  reloadKey = 0,
  search,
}: {
  from?: ValidateFromPath;
  reloadKey?: number;
  search?: TableParams;
}) {
  const auth = useKrakstackAuth();
  const locale = auth?.locale ?? "en";
  const m = labels(locale);
  const baseUrl = auth?.baseUrl;
  const projectId = auth?.projectId;
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingOrganization, setEditingOrganization] =
    useState<AdminOrganization | null>(null);
  const [deletingOrganization, setDeletingOrganization] =
    useState<AdminOrganization | null>(null);
  const [localSearch, setLocalSearch] = useState<TableParams>({
    globalFilter: "",
  });
  const tableSearch = search ?? localSearch;
  const result = useAtomValue(
    organizationsAtom(baseUrl)(
      adminOrganizationsFamilyKey(
        tableSearch,
        projectId,
        reloadKey + refreshKey,
      ),
    ),
  );
  const organizations = AsyncResult.match(result, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => Array.from(value.data),
  });
  const total = AsyncResult.match(result, {
    onInitial: () => 0,
    onFailure: () => 0,
    onSuccess: ({ value }) => value.meta.total,
  });
  const error = AsyncResult.match(result, {
    onInitial: () => "",
    onFailure: () => m.organization_fetch_error,
    onSuccess: () => "",
  });
  const isLoading = AsyncResult.match(result, {
    onInitial: () => true,
    onFailure: () => false,
    onSuccess: () => false,
  });

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columns={organizationColumns(m, locale, baseUrl)}
        data={organizations}
        features={{
          columnVisibility: { default: { id: false } },
          export: { baseName: "organizations" },
          gallery: false,
          pagination: { mode: "server", rowCount: total },
          rowActions: {
            items: [
              {
                name: m.organization_action_edit,
                icon: <Pencil className="size-4" />,
                onClick: setEditingOrganization,
              },
              {
                name: m.organization_action_delete,
                icon: <Trash2 className="size-4" />,
                variant: "destructive",
                onClick: setDeletingOrganization,
                visible: (organization) => !organization.userId,
              },
            ],
          },
        }}
        {...(from ? { routeFrom: from } : {})}
        {...(!search
          ? {
              search: tableSearch,
              onSearchChange: setLocalSearch,
              searchState: "local" as const,
            }
          : {})}
        onRefresh={() => setRefreshKey((current) => current + 1)}
        state={{ loading: isLoading }}
      />
      {editingOrganization ? (
        <AdminOrganizationForm
          organization={editingOrganization}
          onClose={() => setEditingOrganization(null)}
          onSaved={() => setRefreshKey((current) => current + 1)}
        />
      ) : null}
      {deletingOrganization ? (
        <DeleteOrganizationDialog
          labels={m}
          organization={deletingOrganization}
          baseUrl={baseUrl}
          onClose={() => setDeletingOrganization(null)}
          onDeleted={() => {
            toast.success(m.organization_deleted_toast);
            setDeletingOrganization(null);
            setRefreshKey((current) => current + 1);
          }}
        />
      ) : null}
    </div>
  );
}

const organizationColumns = (
  m: AdminOrganizationsLabels,
  locale: KrakstackAuthLocale,
  baseUrl?: string | undefined,
): DataTableColumnDef<AdminOrganization>[] => [
  {
    accessorKey: "id",
    header: m.admin_column_id,
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: m.admin_column_organization,
    cell: ({ row }) => {
      const display = organizationDisplay(row.original, locale, baseUrl);

      return (
        <AppBrand
          to={null}
          label={display.name}
          subtitle={row.original.slug}
          icon={Building2}
          className="min-w-56"
          {...(display.image ? { imageSrc: display.image } : {})}
        />
      );
    },
  },
  {
    accessorKey: "memberCount",
    header: m.admin_column_members,
    cell: ({ row }) => (
      <OrganizationMembers
        baseUrl={baseUrl}
        members={row.original.memberPreviews ?? []}
        total={row.original.memberCount ?? 0}
      />
    ),
  },
  {
    accessorKey: "projects",
    header: m.admin_column_projects,
    cell: ({ row }) => (
      <DataTableListSummary
        emptyLabel="-"
        items={(row.original.projects ?? []).map((project) => {
          const logo = assetUrl(project.logo, baseUrl);
          return {
            label: project.name,
            value: project.id,
            icon: logo ? (
              <img alt="" className="size-full object-cover" src={logo} />
            ) : (
              initials(project.name)
            ),
          };
        })}
        variant="icon"
      />
    ),
  },
  {
    accessorKey: "createdAt",
    header: m.admin_column_created,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function OrganizationMembers({
  baseUrl,
  members,
  total,
}: {
  baseUrl?: string | undefined;
  members: NonNullable<AdminOrganization["memberPreviews"]>;
  total: number;
}) {
  return (
    <DataTableListSummary
      emptyLabel="0"
      items={members.map((member) => {
        const image = assetUrl(member.image, baseUrl);
        return {
          label: member.name,
          value: member.id,
          icon: image ? (
            <img alt="" className="size-full object-cover" src={image} />
          ) : (
            initials(member.name)
          ),
        };
      })}
      totalCount={total}
      variant="icon"
    />
  );
}

function DeleteOrganizationDialog({
  baseUrl,
  labels: m,
  organization,
  onClose,
  onDeleted,
}: {
  baseUrl?: string | undefined;
  labels: AdminOrganizationsLabels;
  organization: AdminOrganization;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleteOrganizationAtom] = useState(() =>
    Atom.fn((id: string) =>
      Effect.flatMap(authHttpClient(baseUrl), (http) =>
        http.admin.deleteOrganization({ params: { id } }),
      ),
    ),
  );
  const deleteOrganization = useAtomSet(deleteOrganizationAtom);
  const result = useAtomValue(deleteOrganizationAtom);
  useAtomSubscribe(deleteOrganizationAtom, (current) => {
    if (AsyncResult.isSuccess(current)) onDeleted();
  });
  const error = AsyncResult.isFailure(result)
    ? Cause.squash(result.cause)
    : undefined;
  const isPending = !AsyncResult.isInitial(result) && result.waiting;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.organization_delete_title}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.organization_delete_description.replace(
              "{name}",
              organization.name,
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <ErrorMessage
            text={
              error instanceof Error
                ? error.message
                : m.organization_delete_error
            }
          />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {m.organization_delete_cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              deleteOrganization(organization.id);
            }}
          >
            {m.organization_delete_confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
