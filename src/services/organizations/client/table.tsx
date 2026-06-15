import { type ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

import type { Organization } from "../schema";

const listOrganizations = async () => {
  const response = await fetch("/api/admin/organizations");
  if (!response.ok) throw new Error(m.organization_fetch_error());
  return (await response.json()) as Organization[];
};

export function OrganizationsTable({ reloadKey = 0 }: { reloadKey?: number }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");

  const loadOrganizations = async () => {
    setError("");
    try {
      setOrganizations(await listOrganizations());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : m.organization_fetch_error(),
      );
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, [reloadKey]);

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columns={organizationColumns}
        data={organizations}
        exportFileName="organizations.csv"
        features={{ gallery: false }}
        from="/admin/organizations"
      />
    </div>
  );
}

const organizationColumns: ColumnDef<Organization>[] = [
  {
    accessorKey: "name",
    header: m.admin_column_organization(),
    cell: ({ row }) => (
      <div className="flex min-w-56 items-center gap-3">
        {row.original.logo ? (
          <img
            src={row.original.logo}
            alt=""
            className="size-9 rounded-md border object-contain"
          />
        ) : (
          <div className="bg-muted size-9 rounded-md border" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{row.original.name}</span>
          <code className="text-muted-foreground truncate text-xs">
            {row.original.slug}
          </code>
        </div>
      </div>
    ),
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
