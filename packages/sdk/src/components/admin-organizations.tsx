import { useAtomValue } from "@effect/atom-react";
import type { ValidateFromPath } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Building2 } from "lucide-react";
import { useState } from "react";

import { DataTable, type TableParams } from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import { AppBrand } from "@/components/ui/app-brand";

import type { AdminOrganization } from "../admin/schema";
import { authClientApi } from "./auth-client-api";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider";
import { assetUrl, organizationBranding } from "./utils";

const defaultMessages = {
  en: {
    admin_column_created: "Created",
    admin_column_members: "Members",
    admin_column_organization: "Organization",
    organization_fetch_error: "Unable to load organizations.",
  },
  fr: {
    admin_column_created: "Créé",
    admin_column_members: "Membres",
    admin_column_organization: "Organisation",
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

const organizationsQuery = (search: TableParams, projectId?: string | null) => {
  const query = {
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 10,
    ...(search.globalFilter ? { globalFilter: search.globalFilter } : {}),
    ...(search.sort ? { sort: search.sort } : {}),
    ...(projectId ? { projectId } : {}),
  };

  return {
    query,
    key: JSON.stringify(query),
  };
};

const organizationsAtom = Atom.family(
  ({
    baseUrl,
    projectId,
    reloadKey,
    search,
  }: {
    baseUrl?: string | undefined;
    projectId?: string | null | undefined;
    reloadKey: number;
    search: TableParams;
  }) => {
    const request = organizationsQuery(search, projectId);

    return authClientApi(baseUrl).query("admin", "listOrganizations", {
      query: request.query,
      timeToLive: "1 minute",
      reactivityKeys: [
        "organizations",
        ...(projectId ? [`project:${projectId}`] : []),
      ],
      serializationKey: `organizations:${reloadKey}:${request.key}`,
    });
  },
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
  const [localSearch, setLocalSearch] = useState<TableParams>({
    globalFilter: "",
  });
  const tableSearch = search ?? localSearch;
  const result = useAtomValue(
    organizationsAtom({
      baseUrl,
      projectId,
      reloadKey: reloadKey + refreshKey,
      search: tableSearch,
    }),
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
        exportFileName="organizations.csv"
        features={{ gallery: false }}
        {...(from ? { from } : {})}
        {...(!search
          ? {
              search: tableSearch,
              onSearchChange: setLocalSearch,
              searchState: "local" as const,
            }
          : {})}
        isLoading={isLoading}
        onRefresh={() => setRefreshKey((current) => current + 1)}
        serverPagination={{ rowCount: total }}
      />
    </div>
  );
}

const organizationColumns = (
  m: AdminOrganizationsLabels,
  locale: KrakstackAuthLocale,
  baseUrl?: string | undefined,
): ColumnDef<AdminOrganization>[] => [
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
      <span className="text-muted-foreground text-sm tabular-nums">
        {(row.original.memberCount ?? 0).toLocaleString()}
      </span>
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
