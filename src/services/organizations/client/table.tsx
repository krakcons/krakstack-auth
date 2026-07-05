import { useAtomValue } from "@effect/atom-react";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Building2 } from "lucide-react";
import { useState } from "react";

import { DataTable, type TableParams } from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import { AppBrand } from "@/components/ui/app-brand";
import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { assetUrl } from "@/lib/assets";
import { authBaseUrl } from "@/services/auth/client";
import { organizationBranding } from "@/services/organizations/branding";
import { AdminApiClient } from "@/lib/admin-api-client";

import type { Organization } from "../schema";

const organizationDisplay = (organization: Organization) => {
  const locale = getLocale() === "fr" ? "fr" : "en";
  const branding = organizationBranding(organization, locale);

  return {
    name: branding?.name ?? organization.name,
    image: assetUrl(branding?.logo, authBaseUrl),
  };
};

const organizationsQuery = (search: TableParams) => {
  const query = {
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 10,
    ...(search.globalFilter ? { globalFilter: search.globalFilter } : {}),
    ...(search.sort ? { sort: search.sort } : {}),
  };

  return {
    query,
    key: JSON.stringify(query),
  };
};

const organizationsAtom = Atom.family(
  ({ reloadKey, search }: { reloadKey: number; search: TableParams }) => {
    const request = organizationsQuery(search);

    return AdminApiClient.query("admin", "listOrganizations", {
      query: request.query,
      timeToLive: "1 minute",
      reactivityKeys: ["organizations"],
      serializationKey: `organizations:${reloadKey}:${request.key}`,
    });
  },
);

export function OrganizationsTable({
  reloadKey = 0,
  search,
}: {
  reloadKey?: number;
  search: TableParams;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const result = useAtomValue(
    organizationsAtom({ reloadKey: reloadKey + refreshKey, search }),
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
    onFailure: () => m.organization_fetch_error(),
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
        columns={organizationColumns}
        data={organizations}
        exportFileName="organizations.csv"
        features={{ gallery: false }}
        from="/admin/organizations"
        isLoading={isLoading}
        onRefresh={() => setRefreshKey((current) => current + 1)}
        serverPagination={{ rowCount: total }}
      />
    </div>
  );
}

const organizationColumns: ColumnDef<Organization>[] = [
  {
    accessorKey: "name",
    header: m.admin_column_organization(),
    cell: ({ row }) => {
      const display = organizationDisplay(row.original);

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
    accessorKey: "logo",
    header: m.organization_field_logo_url(),
    cell: ({ row }) =>
      row.original.logo ? (
        <Badge variant="outline">{m.oauth_client_logo_configured()}</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">{m.admin_none()}</span>
      ),
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
