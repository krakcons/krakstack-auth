import { type ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import { AppBrand } from "@/components/ui/app-brand";
import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { assetUrl } from "@/lib/assets";
import { authBaseUrl } from "@/services/auth/client";
import { organizationBranding } from "@/services/organizations/branding";

import type { Organization } from "../schema";

const organizationDisplay = (organization: Organization) => {
  const locale = getLocale() === "fr" ? "fr" : "en";
  const branding = organizationBranding(organization, locale);

  return {
    name: branding?.name ?? organization.name,
    image: assetUrl(branding?.logo, authBaseUrl),
  };
};

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
