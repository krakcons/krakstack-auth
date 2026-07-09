import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import {
  KeyRound,
  KeySquare,
  LayoutDashboard,
  Building2,
  FolderKanban,
  Globe2,
  Users,
} from "lucide-react";
import { Suspense } from "react";

import { m } from "@/paraglide/messages";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { Loading } from "@/components/ui/loading";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarLayout, type NavGroup } from "@/components/ui/sidebar-layout";
import { authBaseUrl, authClient } from "@/services/auth/client";
import {
  AdminRequired,
  KrakstackAuthProvider,
  OrganizationSwitcher,
  UserButton,
} from "@krak-stack/auth";

const krakOrganizationId = import.meta.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID;

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession({
      query: { disableCookieCache: true },
    });

    if (!session.data?.user) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: Admin,
});

function Admin() {
  return (
    <KrakstackAuthProvider
      authClient={authClient}
      baseUrl={authBaseUrl}
      projectId={import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID}
    >
      <AdminContent />
    </KrakstackAuthProvider>
  );
}

const adminNavGroups: NavGroup[] = [
  {
    label: m.sidebar_group_manage,
    items: [
      { label: m.sidebar_nav_dashboard, href: "/admin", icon: LayoutDashboard },
      {
        label: m.sidebar_nav_projects,
        href: "/admin/projects",
        icon: FolderKanban,
      },
      {
        label: m.sidebar_nav_domains,
        href: "/admin/domains",
        icon: Globe2,
      },
      {
        label: m.sidebar_nav_api_keys,
        href: "/admin/api-keys",
        icon: KeySquare,
      },
      {
        label: m.sidebar_nav_clients,
        href: "/admin/oauth/clients",
        icon: KeyRound,
      },
    ],
  },
  {
    label: m.sidebar_group_admin,
    items: [
      { label: m.sidebar_nav_users, href: "/admin/users", icon: Users },
      {
        label: m.sidebar_nav_organizations,
        href: "/admin/organizations",
        icon: Building2,
      },
    ],
  },
];

function AdminContent() {
  const session = authClient.useSession();

  if (!krakOrganizationId) {
    throw new Error("VITE_KRAKSTACK_AUTH_ORGANIZATION_ID is required.");
  }

  if (session.isPending && !session.data) {
    return <AdminAccessLoading />;
  }

  return (
    <Suspense fallback={<AdminAccessLoading />}>
      <AdminRequired
        authClient={authClient}
        organizationId={krakOrganizationId}
      >
        <SidebarLayout
          sidebarHeader={<AdminOrganizationSwitcher />}
          headerActions={
            <>
              <ThemeToggle />
              <LocaleSwitcher />
              <UserButton authClient={authClient} baseUrl={authBaseUrl} />
            </>
          }
          groups={adminNavGroups}
        >
          <Outlet />
        </SidebarLayout>
      </AdminRequired>
    </Suspense>
  );
}

function AdminAccessLoading() {
  return <Loading label={m.admin_checking_access()} variant="centered" />;
}

function AdminOrganizationSwitcher() {
  const { isMobile } = useSidebar();

  return (
    <OrganizationSwitcher
      authClient={authClient}
      baseUrl={authBaseUrl}
      locked
      side={isMobile ? "bottom" : "right"}
    />
  );
}
