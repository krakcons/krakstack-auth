import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import type { AdminApiKey } from "@krak-stack/auth/admin";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  Check,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DataTable,
  type DataTableColDef,
} from "@krak-stack/registry/data-table";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckboxField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@krak-stack/registry/effect-form";
import { Separator } from "@/components/ui/separator";
import { AdminApiClient } from "@/lib/admin-api-client";
import { ApiClient } from "@/lib/api-client";
import { m } from "@/paraglide/messages";
import { Query, QueryStandard } from "@krak-stack/registry/query";
import { parseApiKeyReferrers } from "@/services/auth/api-key-referrers";

export const Route = createFileRoute("/admin/api-keys")({
  validateSearch: QueryStandard,
  component: ApiKeysPage,
});

type ApiKeySummary = AdminApiKey;

const createApiKeyAtom = ApiClient.mutation("authExtra", "createApiKey");
const updateApiKeyAtom = AdminApiClient.mutation("admin", "updateApiKey");
const deleteApiKeyAtom = AdminApiClient.mutation("admin", "deleteApiKey");
const resetApiKeyRateLimitAtom = AdminApiClient.mutation(
  "admin",
  "resetApiKeyRateLimit",
);
const enableApiKeyRateLimitAtom = AdminApiClient.mutation(
  "admin",
  "enableApiKeyRateLimit",
);
const disableApiKeyRateLimitAtom = AdminApiClient.mutation(
  "admin",
  "disableApiKeyRateLimit",
);
const apiKeysAtom = Atom.family((reloadKey: number) =>
  AdminApiClient.query("admin", "listApiKeys", {
    timeToLive: "1 minute",
    reactivityKeys: ["api-keys"],
    serializationKey: `api-keys:${reloadKey}`,
  }),
);

function ApiKeysPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const deleteApiKey = useAtomSet(deleteApiKeyAtom, { mode: "promise" });
  const resetApiKeyRateLimit = useAtomSet(resetApiKeyRateLimitAtom, {
    mode: "promise",
  });
  const enableApiKeyRateLimit = useAtomSet(enableApiKeyRateLimitAtom, {
    mode: "promise",
  });
  const disableApiKeyRateLimit = useAtomSet(disableApiKeyRateLimitAtom, {
    mode: "promise",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const result = useAtomValue(apiKeysAtom(reloadKey));
  const [creating, setCreating] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeySummary | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keys = AsyncResult.match(result, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => Array.from(value),
  });
  const loading = AsyncResult.match(result, {
    onInitial: () => true,
    onFailure: () => false,
    onSuccess: () => false,
  });
  const loadError = AsyncResult.match(result, {
    onInitial: () => null,
    onFailure: () => m.admin_api_keys_load_error(),
    onSuccess: () => null,
  });

  const copyCreatedKey = async () => {
    if (!createdKey) return;

    await navigator.clipboard.writeText(createdKey);
    setCopiedKey(true);
    toast.success(m.admin_api_key_copied());
    window.setTimeout(() => setCopiedKey(false), 2000);
  };

  const deleteKey = async (key: ApiKeySummary) => {
    try {
      setError(null);
      await deleteApiKey({ params: { id: key.id } });
      toast.success(m.admin_api_key_deleted_toast());
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : m.admin_api_key_delete_error(),
      );
    }
  };

  const resetRateLimit = async (key: ApiKeySummary) => {
    try {
      setError(null);
      await resetApiKeyRateLimit({ params: { id: key.id } });
      toast.success(m.admin_api_key_rate_limit_reset_toast());
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : m.admin_api_key_rate_limit_reset_error(),
      );
    }
  };

  const setRateLimitEnabled = async (key: ApiKeySummary, enabled: boolean) => {
    try {
      setError(null);
      if (enabled) {
        await enableApiKeyRateLimit({ params: { id: key.id } });
      } else {
        await disableApiKeyRateLimit({ params: { id: key.id } });
      }
      toast.success(
        enabled
          ? m.admin_api_key_rate_limit_enabled_toast()
          : m.admin_api_key_rate_limit_disabled_toast(),
      );
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : m.admin_api_key_rate_limit_toggle_error(),
      );
    }
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
        {(error ?? loadError) ? (
          <p className="text-destructive text-sm">{error ?? loadError}</p>
        ) : null}
        <DataTable
          columnDefs={apiKeyColumns()}
          rowData={keys}
          features={{
            export: { baseName: "api-keys" },
            gallery: false,
            rowActions: {
              items: [
                {
                  name: m.admin_action_edit(),
                  icon: <Pencil />,
                  onClick: (key) => {
                    setCreatedKey(null);
                    setCopiedKey(false);
                    setEditingKey(key);
                  },
                },
                {
                  name: m.admin_api_key_rate_limit_reset(),
                  icon: <RotateCcw />,
                  onClick: resetRateLimit,
                },
                {
                  name: m.admin_api_key_rate_limit_disable(),
                  icon: <ShieldOff />,
                  visible: (key) => key.rateLimitEnabled,
                  onClick: (key) => setRateLimitEnabled(key, false),
                },
                {
                  name: m.admin_api_key_rate_limit_enable(),
                  icon: <ShieldCheck />,
                  visible: (key) => !key.rateLimitEnabled,
                  onClick: (key) => setRateLimitEnabled(key, true),
                },
                {
                  name: m.admin_api_key_delete(),
                  icon: <Trash2 />,
                  variant: "destructive",
                  onClick: deleteKey,
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
          status={
            loading ? { loading: true, empty: m.admin_api_keys_loading() } : {}
          }
        />
      </div>
      <Dialog
        open={creating || Boolean(editingKey)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditingKey(null);
            setCreatedKey(null);
            setCopiedKey(false);
          }
        }}
      >
        <DialogContent className="max-w-lg overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingKey
                ? m.admin_api_key_edit_title()
                : m.admin_create_api_key()}
            </DialogTitle>
            <DialogDescription>
              {editingKey
                ? m.admin_api_key_edit_description()
                : m.admin_api_key_create_description()}
            </DialogDescription>
          </DialogHeader>
          <ApiKeyForm
            key={editingKey?.id ?? "create"}
            apiKey={editingKey}
            onCreated={(key) => {
              setCreatedKey(key);
              setCopiedKey(false);
              setCreating(true);
              setReloadKey((value) => value + 1);
            }}
            onSaved={() => {
              setEditingKey(null);
              setReloadKey((value) => value + 1);
            }}
          />
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

type ApiKeyFormValues = {
  name: string;
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitMax: string;
  rateLimitTimeWindowMinutes: string;
  referrers: string;
};

const apiKeyFormBuilder = FormBuilder.empty
  .addField("name", Schema.String)
  .addField("enabled", Schema.Boolean)
  .addField("rateLimitEnabled", Schema.Boolean)
  .addField("rateLimitMax", Schema.String)
  .addField("rateLimitTimeWindowMinutes", Schema.String)
  .addField("referrers", Schema.String);

const apiKeyFormDefaults = (apiKey: ApiKeySummary | null): ApiKeyFormValues =>
  apiKey
    ? {
        name: apiKey.name ?? "",
        enabled: apiKey.enabled,
        rateLimitEnabled: apiKey.rateLimitEnabled,
        rateLimitMax: apiKey.rateLimitMax?.toString() ?? "",
        rateLimitTimeWindowMinutes: apiKey.rateLimitTimeWindow
          ? Math.round(apiKey.rateLimitTimeWindow / 60000).toString()
          : "",
        referrers: apiKey.referrers.join("\n"),
      }
    : {
        name: "",
        enabled: true,
        rateLimitEnabled: true,
        rateLimitMax: "10000",
        rateLimitTimeWindowMinutes: "1440",
        referrers: "",
      };

const optionalNumber = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const number = Number(trimmed);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(m.admin_api_key_number_error({ field: label }));
  }

  return number;
};

const makeApiKeyForm = (apiKey: ApiKeySummary | null) =>
  FormReact.make(apiKeyFormBuilder, {
    fields: {
      name: TextField,
      enabled: CheckboxField,
      rateLimitEnabled: CheckboxField,
      rateLimitMax: TextField,
      rateLimitTimeWindowMinutes: TextField,
      referrers: TextAreaField,
    },
    onSubmit: (_, { decoded: value, get }) => {
      const name = value.name.trim();
      const rateLimitMax = optionalNumber(
        value.rateLimitMax,
        m.admin_api_key_max_requests(),
      );
      const rateLimitTimeWindowMinutes = optionalNumber(
        value.rateLimitTimeWindowMinutes,
        m.admin_api_key_window_minutes_label(),
      );
      const payload = {
        name: name || null,
        enabled: value.enabled,
        rateLimitEnabled: value.rateLimitEnabled,
        rateLimitMax,
        rateLimitTimeWindow: rateLimitTimeWindowMinutes
          ? rateLimitTimeWindowMinutes * 60 * 1000
          : null,
        referrers: parseApiKeyReferrers(
          value.referrers,
          m.admin_api_key_referrer_error({ referrer: "{referrer}" }),
        ),
      };

      if (apiKey) {
        return get
          .setResult(updateApiKeyAtom, {
            params: { id: apiKey.id },
            payload,
          })
          .pipe(
            Effect.as(apiKey.id),
            Effect.mapError((cause) =>
              cause instanceof Error ? cause : new Error(String(cause)),
            ),
          );
      }

      const createPayload = name
        ? { configId: "service" as const, name }
        : { configId: "service" as const };
      return get.setResult(createApiKeyAtom, { payload: createPayload }).pipe(
        Effect.flatMap((created) =>
          get
            .setResult(updateApiKeyAtom, {
              params: { id: created.id },
              payload,
            })
            .pipe(Effect.as(created.key)),
        ),
        Effect.mapError((cause) =>
          cause instanceof Error ? cause : new Error(String(cause)),
        ),
      );
    },
  });

function ApiKeyForm({
  apiKey,
  onCreated,
  onSaved,
}: {
  apiKey: ApiKeySummary | null;
  onCreated: (key: string) => void;
  onSaved: () => void;
}) {
  const [form] = useState(() => makeApiKeyForm(apiKey));
  const submit = useAtomSet(form.submit);
  const reset = useAtomSet(form.reset);
  const submitResult = useAtomValue(form.submit);
  useAtomSubscribe(form.submit, (result) => {
    if (!AsyncResult.isSuccess(result)) return;
    if (apiKey) {
      toast.success(m.admin_api_key_updated_toast());
      onSaved();
      return;
    }
    toast.success(m.admin_api_key_created_toast());
    reset();
    onCreated(result.value);
  });

  return (
    <form.Initialize defaultValues={apiKeyFormDefaults(apiKey)}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        {!apiKey ? (
          <p className="text-muted-foreground text-sm">
            {m.admin_api_key_warning()}
          </p>
        ) : null}
        <form.name label={m.admin_api_key_name()} />
        <form.enabled label={m.admin_api_key_enabled()} />
        <form.rateLimitEnabled label={m.admin_api_key_rate_limit_enabled()} />
        <form.referrers
          label={m.admin_api_key_referrers()}
          description={m.admin_api_key_referrers_description()}
          placeholder={m.admin_api_key_referrers_placeholder()}
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <form.rateLimitMax
            label={m.admin_api_key_max_requests()}
            min={0}
            type="number"
          />
          <form.rateLimitTimeWindowMinutes
            label={m.admin_api_key_window_minutes_label()}
            min={0}
            type="number"
          />
        </div>
        <SubmitError result={submitResult} />
        <SubmitButton form={form} />
      </form>
    </form.Initialize>
  );
}

const apiKeyColumns = (): DataTableColDef<ApiKeySummary>[] => [
  {
    field: "name",
    headerName: m.admin_api_key_name(),
    cellRenderer: ({ data }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">
          {data.name ?? m.admin_api_key_unnamed()}
        </p>
        <p className="text-muted-foreground text-sm">
          {data.start
            ? m.admin_api_key_starts_with({ start: data.start })
            : m.admin_api_key_hidden()}
        </p>
      </div>
    ),
  },
  {
    field: "configId",
    headerName: m.admin_api_key_type(),
    cellRenderer: ({ data }) => (
      <Badge variant="secondary">{apiKeyTypeLabel(data.configId)}</Badge>
    ),
  },
  {
    field: "enabled",
    headerName: m.admin_api_key_status(),
    cellRenderer: ({ data }) => (
      <Badge variant={data.enabled ? "default" : "secondary"}>
        {data.enabled ? m.admin_api_key_enabled() : m.admin_api_key_disabled()}
      </Badge>
    ),
  },
  {
    colId: "referrers",
    valueGetter: ({ data }) => data.referrers.join(", "),
    headerName: m.admin_api_key_referrers_column(),
    cellRenderer: ({ data }) =>
      data.referrers.length > 0 ? (
        <div className="flex max-w-sm flex-wrap gap-1.5">
          {data.referrers.map((referrer) => (
            <Badge key={referrer} variant="secondary">
              {referrer}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">
          {m.admin_api_key_referrers_any()}
        </span>
      ),
  },
  {
    colId: "rateLimit",
    valueGetter: ({ data }) => usagePercent(data),
    headerName: m.admin_api_key_rate_limit(),
    cellRenderer: ({ data }) => <ApiKeyRateLimit keyData={data} />,
  },
  {
    field: "lastRequest",
    headerName: m.admin_api_key_last_used(),
    cellRenderer: ({ data }) => formatDateTime(data.lastRequest),
  },
  {
    field: "createdAt",
    headerName: m.admin_api_key_created(),
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(data.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

const ApiKeyRateLimit = ({ keyData }: { keyData: ApiKeySummary }) => {
  if (!keyData.rateLimitEnabled) {
    return <Badge variant="secondary">{m.admin_api_key_disabled()}</Badge>;
  }

  if (!keyData.rateLimitMax) {
    return (
      <span className="text-muted-foreground text-sm">
        {m.admin_api_key_unlimited()}
      </span>
    );
  }

  const percent = usagePercent(keyData);

  return (
    <div className="min-w-28 space-y-1">
      <div className="text-muted-foreground flex justify-between gap-2 text-xs">
        <span>
          {keyData.requestCount}/{keyData.rateLimitMax}
        </span>
        <span>{percent}%</span>
      </div>
      <div
        aria-label={m.admin_api_key_usage()}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {formatWindow(keyData.rateLimitTimeWindow)}
      </p>
    </div>
  );
};

const usagePercent = (keyData: ApiKeySummary) => {
  if (!keyData.rateLimitMax) return 0;
  return Math.min(
    100,
    Math.round((keyData.requestCount / keyData.rateLimitMax) * 100),
  );
};

const apiKeyTypeLabel = (configId: string) => {
  switch (configId) {
    case "default":
      return m.admin_api_key_type_default();
    case "service":
      return m.admin_api_key_type_service();
    case "organization":
      return m.admin_api_key_type_organization();
    case "user":
      return m.admin_api_key_type_user();
    default:
      return configId;
  }
};

const formatDateTime = (value: Date | null) =>
  value ? new Date(value).toLocaleString() : m.admin_api_key_never();

const formatWindow = (value: number | null) => {
  if (!value) return m.admin_api_key_none();

  const seconds = Math.round(value / 1000);
  if (seconds % 86400 === 0) {
    return m.admin_api_key_window_days({ count: seconds / 86400 });
  }
  if (seconds % 3600 === 0) {
    return m.admin_api_key_window_hours({ count: seconds / 3600 });
  }
  if (seconds % 60 === 0) {
    return m.admin_api_key_window_minutes({ count: seconds / 60 });
  }

  return m.admin_api_key_window_seconds({ count: seconds });
};
