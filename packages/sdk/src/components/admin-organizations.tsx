import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Cause, Effect, Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Building2, Pencil, Trash2, UserCog } from "lucide-react";
import { useState } from "react";

import {
  DataTable,
  type DataTableColDef,
  DataTableListSummary,
} from "@krak-stack/registry/data-table";
import {
  SortParamsFromString,
  type QueryType,
} from "@krak-stack/registry/query";
import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { AppBrand } from "@krak-stack/registry/app-brand";
import * as messages from "@/paraglide/messages";
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
import { notifyAuthChange } from "./auth-atoms.js";

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

const organizationsQuery = (search: QueryType, projectId?: string | null) => {
  let query: AdminOrganizationsQuery = {
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 10,
  };
  if (search.globalFilter)
    query = { ...query, globalFilter: search.globalFilter };
  if (search.sort)
    query = {
      ...query,
      sort: Schema.encodeSync(SortParamsFromString)(search.sort),
    };
  if (projectId) query = { ...query, projectId };

  return query;
};

const adminOrganizationsFamilyKey = (
  search: QueryType,
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
  onSearchChange,
  reloadKey = 0,
  search,
}: {
  onSearchChange?: (search: QueryType) => void;
  reloadKey?: number;
  search?: QueryType;
}) {
  const auth = useKrakstackAuth();
  const locale = auth?.locale ?? "en";
  const m = labels(locale);
  const baseUrl = auth?.baseUrl;
  const projectId = auth?.projectId;
  const navigate = useNavigate();
  const router = useRouter();
  const [impersonateAtom] = useState(() =>
    authClientApi(baseUrl).runtime.fn(
      ({
        userId,
        organizationId,
      }: {
        userId: string;
        organizationId: string;
      }) =>
        Effect.gen(function* () {
          const client = yield* authHttpClient(baseUrl);
          yield* client.auth.adminImpersonateUser({ payload: { userId } });
          yield* client.auth
            .organizationSetActive({ payload: { organizationId } })
            .pipe(
              Effect.tapError(() =>
                client.auth.adminStopImpersonating({ payload: {} }),
              ),
              Effect.ensuring(Effect.sync(notifyAuthChange)),
            );
          yield* Effect.tryPromise({
            try: async () => {
              await navigate({ to: "/" });
              await router.invalidate();
            },
            catch: (cause) =>
              cause instanceof Error ? cause : new Error(String(cause)),
          });
        }),
    ),
  );
  const impersonate = useAtomSet(impersonateAtom);
  const impersonateResult = useAtomValue(impersonateAtom);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingOrganization, setEditingOrganization] =
    useState<AdminOrganization | null>(null);
  const [deletingOrganization, setDeletingOrganization] =
    useState<AdminOrganization | null>(null);
  const [localSearch, setLocalSearch] = useState<QueryType>({
    page: 0,
    pageSize: 10,
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
      {AsyncResult.isFailure(impersonateResult) ? (
        <ErrorMessage
          text={messages.organization_impersonate_member_error({}, { locale })}
        />
      ) : null}
      <DataTable
        columnDefs={organizationColumns(
          m,
          locale,
          baseUrl,
          impersonate,
          impersonateResult.waiting,
        )}
        rowData={organizations}
        features={{
          columnVisibility: true,
          export: { baseName: "organizations" },
          gallery: false,
          pagination: { mode: "server", rowCount: total },
          refresh: () => setRefreshKey((current) => current + 1),
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
        initialState={tableSearch}
        onStateChange={({ page, pageSize, globalFilter, sort }) => {
          const nextSearch = { page, pageSize, globalFilter, sort };
          if (onSearchChange) {
            onSearchChange(nextSearch);
          } else {
            setLocalSearch(nextSearch);
          }
        }}
        status={{ loading: isLoading }}
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
  baseUrl: string | undefined,
  impersonate: (input: { userId: string; organizationId: string }) => void,
  isImpersonating: boolean,
): DataTableColDef<AdminOrganization>[] => [
  {
    field: "name",
    headerName: m.admin_column_organization,
    cellRenderer: ({ data }) => {
      const display = organizationDisplay(data, locale, baseUrl);

      return (
        <AppBrand
          to={null}
          label={display.name}
          subtitle={data.slug}
          icon={Building2}
          className="min-w-56"
          {...(display.image ? { imageSrc: display.image } : {})}
        />
      );
    },
  },
  {
    field: "memberCount",
    headerName: m.admin_column_members,
    type: "list",
    typeOptions: {
      emptyLabel: "0",
      display: "icon",
      getItems: (row) =>
        (row.memberPreviews ?? []).map((member) => ({
          value: member.id,
          label: member.name,
          imageSrc: assetUrl(member.image, baseUrl),
        })),
      getTotalCount: (row) => row.memberCount ?? 0,
      actionsLabel: m.admin_column_members,
      itemActions: [
        {
          name: messages.organization_impersonate_member({}, { locale }),
          icon: <UserCog className="size-4" />,
          disabled: () => isImpersonating,
          onClick: ({ item, row }) => {
            if (item.value)
              impersonate({ userId: item.value, organizationId: row.id });
          },
        },
      ],
    },
  },
  {
    field: "projects",
    headerName: m.admin_column_projects,
    cellRenderer: ({ data }) => (
      <DataTableListSummary
        emptyLabel="-"
        items={(data.projects ?? []).map((project) => {
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
        display="icon"
      />
    ),
  },
  {
    field: "createdAt",
    headerName: m.admin_column_created,
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(data.createdAt).toLocaleDateString()}
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
    authClientApi(baseUrl).runtime.fn((id: string) =>
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
