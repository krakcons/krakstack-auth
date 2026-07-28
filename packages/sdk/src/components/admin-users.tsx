import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  useNavigate,
  useRouter,
  type ValidateFromPath,
} from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  Ban,
  Building2,
  Loader2,
  ShieldOff,
  UserCog,
  UserIcon,
} from "lucide-react";
import { useState } from "react";

import {
  DataTable,
  DataTableListSummary,
  type TableParams,
} from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/effect-form";
import { AppBrand } from "@/components/ui/app-brand";
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
} from "../admin/schema";

import type { AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider";
import { assetUrl } from "./utils";

const defaultMessages = {
  en: {
    admin_action_ban: "Ban",
    admin_action_impersonate: "Impersonate",
    admin_action_impersonate_organization: "Impersonate as organization",
    admin_action_unban: "Unban",
    admin_ban_description:
      "Are you sure you want to ban {name} ({email})? They will not be able to sign in.",
    admin_ban_title: "Ban user",
    admin_column_created: "Created",
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
    admin_error_impersonate_organization:
      "Unable to impersonate user as organization.",
    admin_error_organization_required: "Select an active organization first.",
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
    admin_action_impersonate_organization:
      "Emprunter l'identité pour l'organisation",
    admin_action_unban: "Débannir",
    admin_ban_description:
      "Êtes-vous sûr de vouloir bannir {name} ({email}) ? Il ne pourra plus se connecter.",
    admin_ban_title: "Bannir l'utilisateur",
    admin_column_created: "Créé",
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
    admin_error_impersonate_organization:
      "Impossible d'emprunter l'identité pour l'organisation.",
    admin_error_organization_required:
      "Sélectionnez d'abord une organisation active.",
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

const adminUsersQuery = (search: TableParams, projectId?: string | null) => {
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

const usersAtom = Atom.family(
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
    const request = adminUsersQuery(search, projectId);

    return authClientApi(baseUrl).query("admin", "listUsers", {
      query: request.query,
      timeToLive: "1 minute",
      reactivityKeys: [
        "admin-users",
        ...(projectId ? [`project:${projectId}`] : []),
      ],
      serializationKey: `admin-users:${reloadKey}:${request.key}`,
    });
  },
);

const banUser = async (
  authClient: AuthUiClient,
  userId: string,
  m: AdminUsersLabels,
) => {
  const result = await authClient.admin.banUser({ userId });
  if (result.error) throw new Error(result.error.message ?? m.admin_error_ban);
};

const unbanUser = async (
  authClient: AuthUiClient,
  userId: string,
  m: AdminUsersLabels,
) => {
  const result = await authClient.admin.unbanUser({ userId });
  if (result.error)
    throw new Error(result.error.message ?? m.admin_error_unban);
};

const impersonateUser = async (
  authClient: AuthUiClient,
  userId: string,
  m: AdminUsersLabels,
) => {
  const result = await authClient.admin.impersonateUser({ userId });
  if (result.error)
    throw new Error(result.error.message ?? m.admin_error_impersonate);
};

type SessionWithActiveOrganization = {
  session?: { activeOrganizationId?: unknown };
};

const activeOrganizationId = (
  session: SessionWithActiveOrganization | null,
) => {
  const value = session?.session?.activeOrganizationId;
  return typeof value === "string" && value ? value : null;
};

export function AdminUsersTable({
  from,
  reloadKey = 0,
  search,
}: {
  from?: ValidateFromPath;
  reloadKey?: number;
  search?: TableParams;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const auth = useKrakstackAuth();
  const m = labels(auth?.locale ?? "en");
  const authClient = auth?.authClient;
  const baseUrl = auth?.baseUrl;
  const { data: session, refetch: refetchSession } =
    authClient?.useSession() ?? {
      data: null,
      refetch: async () => undefined,
    };
  const impersonateOrganizationUser = useAtomSet(
    authClientApi(baseUrl).mutation("auth", "organizationImpersonateUser"),
    { mode: "promise" },
  );
  const projectId = auth?.projectId;
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(
    null,
  );
  const [impersonateError, setImpersonateError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [localSearch, setLocalSearch] = useState<TableParams>({
    globalFilter: "",
  });
  const tableSearch = search ?? localSearch;
  const result = useAtomValue(
    usersAtom({
      baseUrl,
      projectId,
      search: tableSearch,
      reloadKey: reloadKey + refreshKey,
    }),
  );
  const [banningUser, setBanningUser] = useState<User | null>(null);
  const [unbanningUser, setUnbanningUser] = useState<User | null>(null);

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

  const refreshSessionAndNavigate = async () => {
    auth?.refreshAuth();
    await refetchSession();
    await navigate({ to: "/" });
    await router.invalidate();
  };

  return (
    <>
      {error ? <ErrorMessage text={error} /> : null}
      {impersonateError ? <ErrorMessage text={impersonateError} /> : null}
      <DataTable
        columns={userColumns(m, baseUrl)}
        data={users}
        features={{
          export: { baseName: "users" },
          gallery: false,
          pagination: { mode: "server", rowCount: total },
          rowActions: {
            items: [
              {
                name: m.admin_action_impersonate,
                icon: impersonatingUserId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserCog className="size-4" />
                ),
                onClick: async (user) => {
                  setImpersonateError("");
                  setImpersonatingUserId(user.id);
                  try {
                    if (!authClient)
                      throw new Error(m.admin_error_access_required);
                    await impersonateUser(authClient, user.id, m);
                    await refreshSessionAndNavigate();
                  } catch (cause) {
                    setImpersonateError(
                      cause instanceof Error
                        ? cause.message
                        : m.admin_error_impersonate,
                    );
                  } finally {
                    setImpersonatingUserId(null);
                  }
                },
                visible: (user) => !user.banned,
              },
              {
                name: m.admin_action_impersonate_organization,
                icon: impersonatingUserId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Building2 className="size-4" />
                ),
                onClick: async (user) => {
                  setImpersonateError("");
                  setImpersonatingUserId(user.id);
                  try {
                    if (!session?.user?.id) {
                      throw new Error(m.admin_error_access_required);
                    }
                    const organizationId = activeOrganizationId(session);
                    if (!organizationId) {
                      throw new Error(m.admin_error_organization_required);
                    }

                    await impersonateOrganizationUser({
                      payload: {
                        organizationId,
                        actorUserId: session.user.id,
                        targetUserId: user.id,
                      },
                    });
                    await refreshSessionAndNavigate();
                  } catch (cause) {
                    setImpersonateError(
                      cause instanceof Error
                        ? cause.message
                        : m.admin_error_impersonate_organization,
                    );
                  } finally {
                    setImpersonatingUserId(null);
                  }
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
      {banningUser ? (
        <BanUserDialog
          labels={m}
          authClient={authClient}
          user={banningUser}
          onBanned={() => setRefreshKey((current) => current + 1)}
          onClose={() => setBanningUser(null)}
        />
      ) : null}
      {unbanningUser ? (
        <UnbanUserDialog
          labels={m}
          authClient={authClient}
          user={unbanningUser}
          onUnbanned={() => setRefreshKey((current) => current + 1)}
          onClose={() => setUnbanningUser(null)}
        />
      ) : null}
    </>
  );
}

export function useAdminUsersTotal(search: TableParams) {
  const auth = useKrakstackAuth();
  const result = useAtomValue(
    usersAtom({
      baseUrl: auth?.baseUrl,
      projectId: auth?.projectId,
      search,
      reloadKey: 0,
    }),
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
): ColumnDef<User>[] => [
  {
    accessorKey: "email",
    header: m.admin_column_user,
    cell: ({ row }) => {
      const image = assetUrl(row.original.image);

      return (
        <AppBrand
          to={null}
          label={row.original.email}
          subtitle={row.original.name}
          icon={UserIcon}
          className="min-w-48"
          {...(image ? { imageSrc: image } : {})}
        />
      );
    },
  },
  {
    accessorKey: "organizations",
    header: m.admin_column_organizations,
    cell: ({ row }) => (
      <DataTableListSummary
        emptyLabel="-"
        items={row.original.organizations.map((organization) => {
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
        variant="icon"
      />
    ),
  },
  {
    accessorKey: "projects",
    header: m.admin_column_projects,
    cell: ({ row }) => (
      <DataTableListSummary
        emptyLabel="-"
        items={row.original.projects.map((project) => {
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
    accessorKey: "emailVerified",
    header: m.admin_column_verified,
    cell: ({ row }) =>
      row.original.emailVerified ? (
        <Badge variant="outline">{m.admin_column_verified}</Badge>
      ) : (
        <Badge variant="secondary">{m.admin_column_unverified}</Badge>
      ),
  },
  {
    accessorKey: "role",
    header: m.admin_column_role,
    cell: ({ row }) => {
      const role = row.original.role;
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
    accessorKey: "banned",
    header: m.admin_column_status,
    cell: ({ row }) =>
      row.original.banned ? (
        <Badge variant="destructive">{m.admin_status_banned}</Badge>
      ) : (
        <Badge variant="outline">{m.admin_status_active}</Badge>
      ),
  },
  {
    accessorKey: "lastSignedIn",
    header: m.admin_column_last_signed_in,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.original.lastSignedIn
          ? new Date(row.original.lastSignedIn).toLocaleString()
          : "-"}
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

function BanUserDialog({
  labels: m,
  authClient,
  user,
  onBanned,
  onClose,
}: {
  labels: AdminUsersLabels;
  authClient?: AuthUiClient | undefined;
  user: User;
  onBanned: () => void;
  onClose: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

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
            onClick={async () => {
              setError("");
              setIsPending(true);
              try {
                if (!authClient) throw new Error(m.admin_error_access_required);
                await banUser(authClient, user.id, m);
                onBanned();
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : m.admin_error_ban,
                );
              } finally {
                setIsPending(false);
              }
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
  authClient,
  user,
  onUnbanned,
  onClose,
}: {
  labels: AdminUsersLabels;
  authClient?: AuthUiClient | undefined;
  user: User;
  onUnbanned: () => void;
  onClose: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

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
            onClick={async () => {
              setError("");
              setIsPending(true);
              try {
                if (!authClient) throw new Error(m.admin_error_access_required);
                await unbanUser(authClient, user.id, m);
                onUnbanned();
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : m.admin_error_unban,
                );
              } finally {
                setIsPending(false);
              }
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
