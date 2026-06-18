import type { ApiKey } from "@better-auth/api-key/client";
import { type ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createDataTableActionsColumn,
  DataTable,
  TableSearchSchemaStandard as TableSearchSchema,
} from "@/components/ui/data-table";
import { SidebarPageHeader } from "@/components/ui/sidebar-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppForm } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/services/auth/client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/api-keys")({
  validateSearch: TableSearchSchema,
  component: ApiKeysPage,
});

type ApiKeySummary = Omit<ApiKey, "key"> & { key?: string };

type CreatedApiKey = {
  id: string;
  key: string;
};

const getCreatedApiKey = (value: unknown): CreatedApiKey | null => {
  if (typeof value !== "object" || value === null) return null;
  if (!("id" in value) || !("key" in value)) return null;

  const id = Reflect.get(value, "id");
  const key = Reflect.get(value, "key");

  return typeof id === "string" && typeof key === "string" ? { id, key } : null;
};

function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    const result = await authClient.apiKey.list({
      query: { configId: "service" },
    });

    if (result.error) {
      setError(result.error.message ?? m.admin_api_keys_load_error());
      setLoading(false);
      return;
    }

    setKeys(result.data?.apiKeys ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadKeys();
  }, []);

  const createForm = useAppForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      setCreatedKey(null);
      setCopiedKey(false);

      const result = await authClient.$fetch("/create-api-key", {
        method: "POST",
        body: {
          configId: "service",
          name: value.name.trim(),
        },
      });
      const created = getCreatedApiKey(result.data);

      if (result.error || !created) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error?.message ?? m.admin_api_key_create_error(),
            fields: {},
          },
        });
        return;
      }

      setCreatedKey(created.key);
      createForm.reset();
      setCreating(true);
      toast.success(m.admin_api_key_created_toast());
      await loadKeys();
    },
  });

  const copyCreatedKey = async () => {
    if (!createdKey) return;

    await navigator.clipboard.writeText(createdKey);
    setCopiedKey(true);
    toast.success(m.admin_api_key_copied());
    window.setTimeout(() => setCopiedKey(false), 2000);
  };

  const deleteKey = async (key: ApiKeySummary) => {
    const result = await authClient.apiKey.delete({
      configId: "service",
      keyId: key.id,
    });

    if (result.error) {
      setError(result.error.message ?? m.admin_api_key_delete_error());
      return;
    }

    toast.success(m.admin_api_key_deleted_toast());
    await loadKeys();
  };

  return (
    <>
      <SidebarPageHeader
        title={m.admin_api_keys_title()}
        description={m.admin_api_keys_description()}
        badge={{ label: m.admin_badge_admin() }}
        actions={
          <Button
            onClick={() => {
              setCreatedKey(null);
              setCopiedKey(false);
              setCreating(true);
            }}
          >
            <Plus data-icon="inline-start" />
            {m.admin_create_api_key()}
          </Button>
        }
      />
      <div className="min-w-0 space-y-4">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DataTable
          columns={apiKeyColumns({ onDelete: deleteKey })}
          data={keys}
          {...(loading ? { emptyLabel: m.admin_api_keys_loading() } : {})}
          exportFileName="service-api-keys.csv"
          features={{ gallery: false }}
        />
      </div>
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) {
            setCreatedKey(null);
            setCopiedKey(false);
            createForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-lg overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{m.admin_create_api_key()}</DialogTitle>
            <DialogDescription>
              {m.admin_api_key_create_description()}
            </DialogDescription>
          </DialogHeader>
          <createForm.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                createForm.handleSubmit();
              }}
            >
              <p className="text-muted-foreground text-sm">
                {m.admin_api_key_warning()}
              </p>
              <createForm.AppField name="name">
                {(field) => (
                  <field.TextField label={m.admin_api_key_name()} required />
                )}
              </createForm.AppField>
              <createForm.FormError />
              <createForm.SubmitButton />
            </form>
          </createForm.AppForm>
          {createdKey ? (
            <>
              <Separator />
              <div className="grid min-w-0 gap-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-medium">
                  {m.admin_api_key_created_title()}
                </div>
                <p className="text-muted-foreground text-sm">
                  {m.admin_api_key_created_description()}
                </p>
                <div className="bg-muted min-w-0 overflow-hidden rounded-md">
                  <code className="block max-w-full overflow-x-auto p-3 text-sm whitespace-nowrap">
                    {createdKey}
                  </code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyCreatedKey}
                  className="self-start"
                >
                  {copiedKey ? <Check /> : <Copy />}
                  {copiedKey
                    ? m.admin_api_key_copied()
                    : m.admin_api_key_copy()}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

const apiKeyColumns = ({
  onDelete,
}: {
  onDelete: (key: ApiKeySummary) => void;
}): ColumnDef<ApiKeySummary>[] => [
  {
    accessorKey: "name",
    header: m.admin_api_key_name(),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">
          {row.original.name ?? m.admin_api_key_unnamed()}
        </p>
        <p className="text-muted-foreground text-sm">
          {row.original.start
            ? m.admin_api_key_starts_with({ start: row.original.start })
            : m.admin_api_key_hidden()}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "enabled",
    header: m.admin_api_key_status(),
    cell: ({ row }) => (
      <Badge variant={row.original.enabled ? "default" : "secondary"}>
        {row.original.enabled
          ? m.admin_api_key_enabled()
          : m.admin_api_key_disabled()}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: m.admin_api_key_created(),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
  createDataTableActionsColumn<ApiKeySummary>([
    {
      name: m.admin_api_key_delete(),
      icon: <Trash2 />,
      variant: "destructive",
      onClick: onDelete,
    },
  ]),
];
