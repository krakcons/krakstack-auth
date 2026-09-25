import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Effect, Schema } from "effect";
import { Ban, Loader2, ShieldOff, UserCog, UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DataTable,
  type DataTableColDef,
  DataTableListSummary,
} from "@krak-stack/registry/data-table";
import {
  Query,
  SortParamsFromString,
  type QueryType,
} from "@krak-stack/registry/query";
import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { AppBrand } from "@krak-stack/registry/app-brand";
import { Badge } from "@/components/ui/badge";
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
import type {
  AdminOrganizationPreview,
  AdminProjectPreview,
} from "../admin/schema.js";

import { notifyAuthChange } from "./auth-atoms.js";
import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider.js";
import { assetUrl } from "./utils.js";

const defaultMessages = {
  en: {
    admin_action_ban: "Ban",
    admin_action_impersonate: "Impersonate",
    admin_action_unban: "Unban",
    admin_ban_description:
      "Are you sure you want to ban {name} ({email})? They will not be able to sign in.",
    admin_ban_title: "Ban user",
    admin_column_created: "Created",
    admin_column_id: "ID",
    admin_column_last_signed_in: "Last signed in",
    admin_column_organizations: "Organizations",
    admin_column_projects: "Projects",
    admin_column_role: "Role",
    admin_column_status: "Status",
    admin_column_unverified: "Unverified",
    admin_column_user: "User",
    admin_column_verified: "Verified",
    admin_error_access_required: "Admin access is required.",
    admin_error_ban: "Unable to ban user.",
    admin_error_impersonate: "Unable to impersonate user.",
    admin_error_unban: "Unable to unban user.",
    admin_status_active: "Active",
    admin_status_banned: "Banned",
    admin_unban_description:
      "Are you sure you want to unban {name} ({email})? They will be able to sign in again.",
    admin_unban_title: "Unban user",
    form_cancel: "Cancel",
    user_role_default: "user",
  },
  fr: {
    admin_action_ban: "Bannir",
    admin_action_impersonate: "Emprunter l'identité",
    admin_action_unban: "Débannir",
    admin_ban_description:
      "Êtes-vous sûr de vouloir bannir {name} ({email}) ? Il ne pourra plus se connecter.",
    admin_ban_title: "Bannir l'utilisateur",
    admin_column_created: "Créé",
    admin_column_id: "ID",
    admin_column_last_signed_in: "Dernière connexion",
    admin_column_organizations: "Organisations",
    admin_column_projects: "Projets",
    admin_column_role: "Rôle",
    admin_column_status: "Statut",
    admin_column_unverified: "Non vérifié",
    admin_column_user: "Utilisateur",
    admin_column_verified: "Vérifié",
    admin_error_access_required: "Accès administrateur requis.",
    admin_error_ban: "Impossible de bannir l'utilisateur.",
    admin_error_impersonate:
      "Impossible d'emprunter l'identité de l'utilisateur.",
    admin_error_unban: "Impossible de débannir l'utilisateur.",
    admin_status_active: "Actif",
    admin_status_banned: "Banni",
    admin_unban_description:
      "Êtes-vous sûr de vouloir débannir {name} ({email}) ? Il pourra se reconnecter.",
    admin_unban_title: "Débannir l'utilisateur",
    form_cancel: "Annuler",
    user_role_default: "utilisateur",
  },
} as const;

const labels = (locale: KrakstackAuthLocale) => ({
  ...defaultMessages[locale],
});

type AdminUsersLabels = ReturnType<typeof labels>;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const text = (value: string, params?: Record<string, string>) =>
  Object.entries(params ?? {}).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, replacement),
    value,
  );

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  lastSignedIn: Date | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  organizations: ReadonlyArray<AdminOrganizationPreview>;
  projects: ReadonlyArray<AdminProjectPreview>;
};

interface AdminUsersQuery {
  page: number;
  pageSize: number;
  globalFilter?: string;
  sort?: string;
  projectId?: string;
}

const AdminUsersFamilyKey = Schema.fromJsonString(
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
).annotate({ identifier: "AdminUsersFamilyKey" });

const adminUsersQuery = (search: QueryType, projectId?: string | null) => {
  let query: AdminUsersQuery = {
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

const adminUsersFamilyKey = (
  search: QueryType,
  projectId: string | null | undefined,
  reloadKey: number,
) => JSON.stringify({ query: adminUsersQuery(search, projectId), reloadKey });

const usersAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((key: string) => {
    const { query, reloadKey } =
      Schema.decodeUnknownSync(AdminUsersFamilyKey)(key);
    return authClientApi(baseUrl).query("admin", "listUsers", {
      query,
      timeToLive: "1 minute",
      reactivityKeys: [
        "admin-users",
        ...(query.projectId ? [`project:${query.projectId}`] : []),
      ],
      serializationKey: `admin-users:${reloadKey}:${JSON.stringify(query)}`,
    });
  }),
);

interface AdminUsersTableRequest {
  readonly baseUrl?: string | undefined;
  readonly projectId?: string | null | undefined;
  readonly reloadKey: number;
  readonly refreshKey: number;
  readonly search: QueryType;
}

const makeAdminUsersTableAtoms = (initial: AdminUsersTableRequest) => {
  const requestAtom = Atom.make(initial);
  const resultAtom = Atom.optimistic(
    Atom.make((get) => {
      const request = get(requestAtom);
      return get.result(
        usersAtom(request.baseUrl)(
          adminUsersFamilyKey(
            request.search,
            request.projectId,
            request.reloadKey + request.refreshKey,
          ),
        ),
        { suspendOnWaiting: true },
      );
    }),
  );

  return { requestAtom, resultAtom } as const;
};

export function AdminUsersTable({
  onSearchChange,
  reloadKey = 0,
  search,
}: {
  onSearchChange?: (search: QueryType) => void;
  reloadKey?: number;
  search?: QueryType;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const auth = useKrakstackAuth();
  const m = labels(auth?.locale ?? "en");
  const baseUrl = auth?.baseUrl;
  const projectId = auth?.projectId;
  const [impersonateError, setImpersonateError] = useState("");
  const [tableAtoms] = useState(() =>
    makeAdminUsersTableAtoms({
      baseUrl,
      projectId,
      reloadKey,
      refreshKey: 0,
      search: search ?? Schema.decodeUnknownSync(Query)({}),
    }),
  );
  const setTableRequest = useAtomSet(tableAtoms.requestAtom);
  const tableRequest = useAtomValue(tableAtoms.requestAtom);
  const result = useAtomValue(tableAtoms.resultAtom);
  useEffect(() => {
    setTableRequest((current) => ({
      ...current,
      baseUrl,
      projectId,
      reloadKey,
      search: search ?? current.search,
    }));
  }, [baseUrl, projectId, reloadKey, search, setTableRequest]);
  const [banningUser, setBanningUser] = useState<User | null>(null);
  const [unbanningUser, setUnbanningUser] = useState<User | null>(null);
  const [impersonateUserAtom] = useState(() =>
    authClientApi(baseUrl).runtime.fn((userId: string) =>
      Effect.gen(function* () {
        const client = yield* authHttpClient(baseUrl);
        yield* client.auth.adminImpersonateUser({ payload: { userId } });
        notifyAuthChange();
        yield* Effect.tryPromise({
          try: async () => {
            await navigate({ to: "/" });
            await router.invalidate();
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.admin_error_impersonate),
        });
      }).pipe(
        Effect.catch((cause) =>
          Effect.sync(() =>
            setImpersonateError(
              cause instanceof Error
                ? cause.message
                : m.admin_error_impersonate,
            ),
          ),
        ),
      ),
    ),
  );
  const impersonateUser = useAtomSet(impersonateUserAtom);
  const impersonateUserResult = useAtomValue(impersonateUserAtom);
  const isImpersonating = impersonateUserResult.waiting;

  const users = AsyncResult.match(result, {
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
    onFailure: () => m.admin_error_access_required,
    onSuccess: () => "",
  });
  const isLoading = AsyncResult.match(result, {
    onInitial: () => true,
    onFailure: () => false,
    onSuccess: () => false,
  });

  return (
    <>
      {error ? <ErrorMessage text={error} /> : null}
      {impersonateError ? <ErrorMessage text={impersonateError} /> : null}
      <DataTable
        columnDefs={userColumns(m, baseUrl)}
        rowData={users}
        features={{
          columnVisibility: true,
          export: { baseName: "users" },
          gallery: false,
          pagination: { mode: "server", rowCount: total },
          refresh: () =>
            setTableRequest((current) => ({
              ...current,
              refreshKey: current.refreshKey + 1,
            })),
          rowActions: {
            items: [
              {
                name: m.admin_action_impersonate,
                icon: isImpersonating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserCog className="size-4" />
                ),
                onClick: (user) => {
                  setImpersonateError("");
                  impersonateUser(user.id);
                },
                visible: (user) => !user.banned,
              },
              {
                name: m.admin_action_ban,
                icon: <Ban className="size-4" />,
                variant: "destructive",
                onClick: (user) => setBanningUser(user),
                visible: (user) => !user.banned,
              },
              {
                name: m.admin_action_unban,
                icon: <ShieldOff className="size-4" />,
                onClick: (user) => setUnbanningUser(user),
                visible: (user) => !!user.banned,
              },
            ],
          },
        }}
        state={tableRequest.search}
        onStateChange={({ page, pageSize, globalFilter, sort }) => {
          const nextSearch = Schema.decodeUnknownSync(Query)({
            page,
            pageSize,
            globalFilter,
            sort,
          });
          setTableRequest((current) => ({
            ...current,
            search: nextSearch,
          }));
          if (onSearchChange) {
            onSearchChange(nextSearch);
          }
        }}
        status={{ loading: isLoading }}
      />
      {banningUser ? (
        <BanUserDialog
          labels={m}
          baseUrl={baseUrl}
          user={banningUser}
          onBanned={() =>
            setTableRequest((current) => ({
              ...current,
              refreshKey: current.refreshKey + 1,
            }))
          }
          onClose={() => setBanningUser(null)}
        />
      ) : null}
      {unbanningUser ? (
        <UnbanUserDialog
          labels={m}
          baseUrl={baseUrl}
          user={unbanningUser}
          onUnbanned={() =>
            setTableRequest((current) => ({
              ...current,
              refreshKey: current.refreshKey + 1,
            }))
          }
          onClose={() => setUnbanningUser(null)}
        />
      ) : null}
    </>
  );
}

export function useAdminUsersTotal(search: QueryType) {
  const auth = useKrakstackAuth();
  const result = useAtomValue(
    usersAtom(auth?.baseUrl)(adminUsersFamilyKey(search, auth?.projectId, 0)),
  );
  return AsyncResult.match(result, {
    onInitial: () => 0,
    onFailure: () => 0,
    onSuccess: ({ value }) => value.meta.total,
  });
}

const userColumns = (
  m: AdminUsersLabels,
  baseUrl?: string | undefined,
): DataTableColDef<User>[] => [
  {
    field: "email",
    headerName: m.admin_column_user,
    cellRenderer: ({ data }) => {
      const image = assetUrl(data.image);

      return (
        <AppBrand
          to={null}
          label={data.email}
          subtitle={data.name}
          icon={UserIcon}
          className="min-w-48"
          {...(image ? { imageSrc: image } : {})}
        />
      );
    },
  },
  {
    field: "organizations",
    headerName: m.admin_column_organizations,
    cellRenderer: ({ data }) => (
      <DataTableListSummary
        emptyLabel="-"
        items={data.organizations.map((organization) => {
          const logo = assetUrl(organization.logo, baseUrl);
          return {
            label: organization.name,
            value: organization.id,
            icon: logo ? (
              <img alt="" className="size-full object-cover" src={logo} />
            ) : (
              initials(organization.name)
            ),
          };
        })}
        display="icon"
      />
    ),
  },
  {
    field: "projects",
    headerName: m.admin_column_projects,
    cellRenderer: ({ data }) => (
      <DataTableListSummary
        emptyLabel="-"
        items={data.projects.map((project) => {
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
    field: "emailVerified",
    headerName: m.admin_column_verified,
    cellRenderer: ({ data }) =>
      data.emailVerified ? (
        <Badge variant="outline">{m.admin_column_verified}</Badge>
      ) : (
        <Badge variant="secondary">{m.admin_column_unverified}</Badge>
      ),
  },
  {
    field: "role",
    headerName: m.admin_column_role,
    cellRenderer: ({ data }) => {
      const role = data.role;
      if (!role) return <Badge variant="outline">{m.user_role_default}</Badge>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {role.split(",").map((r) => (
            <Badge
              key={r.trim()}
              variant={r.trim() === "admin" ? "default" : "outline"}
            >
              {r.trim()}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    field: "banned",
    headerName: m.admin_column_status,
    cellRenderer: ({ data }) =>
      data.banned ? (
        <Badge variant="destructive">{m.admin_status_banned}</Badge>
      ) : (
        <Badge variant="outline">{m.admin_status_active}</Badge>
      ),
  },
  {
    field: "lastSignedIn",
    headerName: m.admin_column_last_signed_in,
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {data.lastSignedIn ? new Date(data.lastSignedIn).toLocaleString() : "-"}
      </span>
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

function BanUserDialog({
  labels: m,
  baseUrl,
  user,
  onBanned,
  onClose,
}: {
  labels: AdminUsersLabels;
  baseUrl?: string | undefined;
  user: User;
  onBanned: () => void;
  onClose: () => void;
}) {
  const [banUserAtom] = useState(() =>
    authClientApi(baseUrl).runtime.fn((userId: string) =>
      Effect.flatMap(authHttpClient(baseUrl), (client) =>
        client.auth.adminBanUser({ payload: { userId } }),
      ).pipe(
        Effect.tap(() => Effect.sync(onBanned)),
        Effect.tap(() => Effect.sync(onClose)),
        Effect.catch((cause) =>
          Effect.sync(() =>
            setError(
              cause instanceof Error ? cause.message : m.admin_error_ban,
            ),
          ),
        ),
      ),
    ),
  );
  const [error, setError] = useState("");
  const banUser = useAtomSet(banUserAtom);
  const isPending = useAtomValue(banUserAtom).waiting;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.admin_ban_title}</AlertDialogTitle>
          <AlertDialogDescription>
            {text(m.admin_ban_description, {
              name: user.name,
              email: user.email,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorMessage text={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {m.form_cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setError("");
              banUser(user.id);
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {m.admin_action_ban}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UnbanUserDialog({
  labels: m,
  baseUrl,
  user,
  onUnbanned,
  onClose,
}: {
  labels: AdminUsersLabels;
  baseUrl?: string | undefined;
  user: User;
  onUnbanned: () => void;
  onClose: () => void;
}) {
  const [unbanUserAtom] = useState(() =>
    authClientApi(baseUrl).runtime.fn((userId: string) =>
      Effect.flatMap(authHttpClient(baseUrl), (client) =>
        client.auth.adminUnbanUser({ payload: { userId } }),
      ).pipe(
        Effect.tap(() => Effect.sync(onUnbanned)),
        Effect.tap(() => Effect.sync(onClose)),
        Effect.catch((cause) =>
          Effect.sync(() =>
            setError(
              cause instanceof Error ? cause.message : m.admin_error_unban,
            ),
          ),
        ),
      ),
    ),
  );
  const [error, setError] = useState("");
  const unbanUser = useAtomSet(unbanUserAtom);
  const isPending = useAtomValue(unbanUserAtom).waiting;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.admin_unban_title}</AlertDialogTitle>
          <AlertDialogDescription>
            {text(m.admin_unban_description, {
              name: user.name,
              email: user.email,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorMessage text={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {m.form_cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setError("");
              unbanUser(user.id);
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {m.admin_action_unban}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
