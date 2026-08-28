import { createFileRoute } from "@tanstack/react-router";
import {
  AdminUsersTable,
  useAdminUsersTotal,
} from "@krak-stack/auth/components";
import { Schema } from "effect";

import { Query, QueryStandard } from "@krak-stack/registry/query";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/users")({
  validateSearch: QueryStandard,
  component: UsersPage,
});

function UsersPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const total = useAdminUsersTotal(search);

  return (
    <>
      <SidebarPageHeader
        title={m.admin_users_title()}
        description={`${m.admin_users_description()} ${total === 1 ? m.admin_users_count_single() : m.admin_users_count({ count: total.toString() })}`}
        badge={{ label: m.admin_badge_admin() }}
      />
      <AdminUsersTable
        search={search}
        onSearchChange={(nextSearch) =>
          void navigate({
            search: Schema.encodeSync(Query)(nextSearch),
          })
        }
      />
    </>
  );
}
