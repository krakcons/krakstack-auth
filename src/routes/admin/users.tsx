import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersTable, useAdminUsersTotal } from "@krak-stack/auth";

import { TableSearchSchemaStandard as TableSearchSchema } from "@/components/ui/data-table";
import { SidebarPageHeader } from "@/components/ui/sidebar-layout";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/users")({
  validateSearch: TableSearchSchema,
  component: UsersPage,
});

function UsersPage() {
  const search = Route.useSearch();
  const total = useAdminUsersTotal(search);

  return (
    <>
      <SidebarPageHeader
        title={m.admin_users_title()}
        description={`${m.admin_users_description()} ${total === 1 ? m.admin_users_count_single() : m.admin_users_count({ count: total.toString() })}`}
        badge={{ label: m.admin_badge_admin() }}
      />
      <AdminUsersTable from="/admin/users" search={search} />
    </>
  );
}
