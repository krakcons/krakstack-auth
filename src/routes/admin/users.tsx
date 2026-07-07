import { useAtomValue } from "@effect/atom-react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Ban, Loader2, ShieldOff, UserIcon } from "lucide-react";
import { useState } from "react";

import {
  DataTable,
  TableSearchSchemaStandard as TableSearchSchema,
} from "@/components/ui/data-table";
import { ErrorMessage } from "@/components/ui/form";
import { AppBrand } from "@/components/ui/app-brand";
import { SidebarPageHeader } from "@/components/ui/sidebar-layout";
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
import { authBaseUrl, authClient } from "@/services/auth/client";
import { m } from "@/paraglide/messages";
import { assetUrl } from "@/lib/assets";
import { AdminApiClient } from "@/lib/admin-api-client";

export const Route = createFileRoute("/admin/users")({
  validateSearch: TableSearchSchema,
  component: UsersPage,
});

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
};

const adminUsersQuery = (search: ReturnType<typeof Route.useSearch>) => {
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

const usersAtom = Atom.family(
  ({
    reloadKey,
    search,
  }: {
    reloadKey: number;
    search: ReturnType<typeof Route.useSearch>;
  }) => {
    const request = adminUsersQuery(search);

    return AdminApiClient.query("admin", "listUsers", {
      query: request.query,
      timeToLive: "1 minute",
      reactivityKeys: ["admin-users"],
      serializationKey: `admin-users:${reloadKey}:${request.key}`,
    });
  },
);

function useBanUser() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await authClient.admin.banUser({ userId });
      if (result.error)
        throw new Error(result.error.message ?? m.admin_error_ban());
    },
  });
}

function useUnbanUser() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await authClient.admin.unbanUser({ userId });
      if (result.error)
        throw new Error(result.error.message ?? m.admin_error_unban());
    },
  });
}

function UsersPage() {
  const search = Route.useSearch();
  const [reloadKey, setReloadKey] = useState(0);
  const result = useAtomValue(usersAtom({ search, reloadKey }));
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
    onFailure: () => m.admin_error_access_required(),
    onSuccess: () => "",
  });
  const isLoading = AsyncResult.match(result, {
    onInitial: () => true,
    onFailure: () => false,
    onSuccess: () => false,
  });

  return (
    <>
      <SidebarPageHeader
        title={m.admin_users_title()}
        description={`${m.admin_users_description()} ${total === 1 ? m.admin_users_count_single() : m.admin_users_count({ count: total.toString() })}`}
        badge={{ label: m.admin_badge_admin() }}
      />

      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columns={userColumns()}
        data={users}
        exportFileName="users.csv"
        features={{ gallery: false }}
        from="/admin/users"
        isLoading={isLoading}
        onRefresh={() => setReloadKey((current) => current + 1)}
        serverPagination={{ rowCount: total }}
        rowActions={[
          {
            name: m.admin_action_ban(),
            icon: <Ban className="size-4" />,
            variant: "destructive",
            onClick: (user) => setBanningUser(user),
            visible: (user) => !user.banned,
          },
          {
            name: m.admin_action_unban(),
            icon: <ShieldOff className="size-4" />,
            onClick: (user) => setUnbanningUser(user),
            visible: (user) => !!user.banned,
          },
        ]}
      />
      {banningUser ? (
        <BanUserDialog
          user={banningUser}
          onBanned={() => setReloadKey((current) => current + 1)}
          onClose={() => setBanningUser(null)}
        />
      ) : null}
      {unbanningUser ? (
        <UnbanUserDialog
          user={unbanningUser}
          onUnbanned={() => setReloadKey((current) => current + 1)}
          onClose={() => setUnbanningUser(null)}
        />
      ) : null}
    </>
  );
}

const userColumns = (): ColumnDef<User>[] => [
  {
    accessorKey: "email",
    header: m.admin_column_user(),
    cell: ({ row }) => {
      const image = assetUrl(row.original.image, authBaseUrl);

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
    accessorKey: "emailVerified",
    header: m.admin_column_verified(),
    cell: ({ row }) =>
      row.original.emailVerified ? (
        <Badge variant="outline">{m.admin_column_verified()}</Badge>
      ) : (
        <Badge variant="secondary">{m.admin_column_unverified()}</Badge>
      ),
  },
  {
    accessorKey: "role",
    header: m.admin_column_role(),
    cell: ({ row }) => {
      const role = row.original.role;
      if (!role)
        return (
          <span className="text-muted-foreground">
            {m.admin_column_role_none()}
          </span>
        );
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
    header: m.admin_column_status(),
    cell: ({ row }) =>
      row.original.banned ? (
        <Badge variant="destructive">{m.admin_status_banned()}</Badge>
      ) : (
        <Badge variant="outline">{m.admin_status_active()}</Badge>
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

function BanUserDialog({
  user,
  onBanned,
  onClose,
}: {
  user: User;
  onBanned: () => void;
  onClose: () => void;
}) {
  const banUser = useBanUser();

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.admin_ban_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.admin_ban_description({ name: user.name, email: user.email })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {banUser.error ? <ErrorMessage text={banUser.error.message} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={banUser.isPending}>
            {m.form_block_navigation_cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              banUser.mutate(user.id, {
                onSuccess: () => {
                  onBanned();
                  onClose();
                },
              });
            }}
            disabled={banUser.isPending}
          >
            {banUser.isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {m.admin_action_ban()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UnbanUserDialog({
  user,
  onUnbanned,
  onClose,
}: {
  user: User;
  onUnbanned: () => void;
  onClose: () => void;
}) {
  const unbanUser = useUnbanUser();

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.admin_unban_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.admin_unban_description({ name: user.name, email: user.email })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {unbanUser.error ? (
          <ErrorMessage text={unbanUser.error.message} />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unbanUser.isPending}>
            {m.form_block_navigation_cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              unbanUser.mutate(user.id, {
                onSuccess: () => {
                  onUnbanned();
                  onClose();
                },
              });
            }}
            disabled={unbanUser.isPending}
          >
            {unbanUser.isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {m.admin_action_unban()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
