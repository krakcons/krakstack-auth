import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createDataTableActionsColumn,
  DataTable,
} from "@/components/data-table";
import { ErrorMessage } from "@/components/form";
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
import { m } from "@/paraglide/messages";

import type { Organization } from "../schema";
import { OrganizationForm } from "./form";

const listOrganizations = async () => {
  const response = await fetch("/api/organizations");
  if (!response.ok) throw new Error(m.organization_fetch_error());
  return (await response.json()) as Organization[];
};

const deleteOrganization = async (id: string) => {
  const response = await fetch(`/api/organizations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) throw new Error(m.organization_delete_error());
  return (await response.json()) as Organization;
};

export function OrganizationsTable({ reloadKey = 0 }: { reloadKey?: number }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [editingOrganization, setEditingOrganization] =
    useState<Organization | null>(null);
  const [deletingOrganization, setDeletingOrganization] =
    useState<Organization | null>(null);
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
        columns={organizationColumns({
          onEdit: setEditingOrganization,
          onDelete: setDeletingOrganization,
        })}
        data={organizations}
        exportFileName="organizations.csv"
        features={{ gallery: false }}
        from="/admin/organizations"
      />
      {editingOrganization ? (
        <OrganizationForm
          organization={editingOrganization}
          onClose={() => setEditingOrganization(null)}
          onSaved={(updated) => {
            setOrganizations((current) =>
              current.map((organization) =>
                organization.id === updated.id ? updated : organization,
              ),
            );
          }}
        />
      ) : null}
      {deletingOrganization ? (
        <DeleteOrganizationDialog
          organization={deletingOrganization}
          onClose={() => setDeletingOrganization(null)}
          onDeleted={(deleted) => {
            setOrganizations((current) =>
              current.filter((organization) => organization.id !== deleted.id),
            );
          }}
        />
      ) : null}
    </div>
  );
}

const organizationColumns = ({
  onEdit,
  onDelete,
}: {
  onEdit: (organization: Organization) => void;
  onDelete: (organization: Organization) => void;
}): ColumnDef<Organization>[] => [
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
  createDataTableActionsColumn<Organization>([
    {
      name: m.admin_action_edit(),
      icon: <Pencil className="size-4" />,
      onClick: onEdit,
    },
    {
      name: m.actions_delete(),
      icon: <Trash2 className="size-4" />,
      variant: "destructive",
      onClick: onDelete,
    },
  ]),
];

function DeleteOrganizationDialog({
  organization,
  onClose,
  onDeleted,
}: {
  organization: Organization;
  onClose: () => void;
  onDeleted: (organization: Organization) => void;
}) {
  const [error, setError] = useState("");

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.organization_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.organization_delete_description({ name: organization.name })}
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
                const deleted = await deleteOrganization(organization.id);
                toast.success(m.organization_deleted_toast());
                onDeleted(deleted);
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : m.organization_delete_error(),
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
