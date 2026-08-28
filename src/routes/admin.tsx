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
import { Effect } from "effect";

import { m } from "@/paraglide/messages";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@krak-stack/registry/locale-switcher";
import { Loading } from "@krak-stack/registry/loading";
import {
  SidebarLayout,
  type NavGroup,
  useSidebarLayout,
} from "@krak-stack/registry/sidebar-layout";
import { authBaseUrl, getAuthSession } from "@/services/auth/client";
import { authAccessLabels } from "@/services/auth/access-labels";
import {
  MemberRequired,
  KrakstackAuthProvider,
  OrganizationSwitcher,
  UserButton,
} from "@krak-stack/auth/components";

const krakOrganizationId = import.meta.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID;
const testApiKeyPermissions = {
  projects: ["read", "create", "update", "delete"],
  users: ["read", "invite", "update"],
  billing: ["read", "manage"],
} as const;

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  beforeLoad: async () => {
    const session = await Effect.runPromise(getAuthSession());

    if (!session?.user) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: Admin,
});

function Admin() {
  return (
    <KrakstackAuthProvider
      accessLabels={authAccessLabels()}
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
  if (!krakOrganizationId) {
    throw new Error("VITE_KRAKSTACK_AUTH_ORGANIZATION_ID is required.");
  }

  return (
    <Suspense fallback={<AdminAccessLoading />}>
      <MemberRequired organizationId={krakOrganizationId}>
        <SidebarLayout
          sidebarHeader={<AdminOrganizationSwitcher />}
          headerActions={
            <>
              <ThemeToggle />
              <LocaleSwitcher />
              <UserButton
                baseUrl={authBaseUrl}
                {...(import.meta.env.DEV
                  ? { apiKeyPermissions: testApiKeyPermissions }
                  : {})}
              />
            </>
          }
          groups={adminNavGroups}
        >
          <Outlet />
        </SidebarLayout>
      </MemberRequired>
    </Suspense>
  );
}

function AdminAccessLoading() {
  return <Loading label={m.admin_checking_access()} variant="centered" />;
}

function AdminOrganizationSwitcher() {
  const { isMobile } = useSidebarLayout();

  return (
    <OrganizationSwitcher
      baseUrl={authBaseUrl}
      {...(import.meta.env.DEV
        ? { apiKeyPermissions: testApiKeyPermissions }
        : {})}
      features={{
        organizationCreation: false,
        organizationSwitching: false,
        userInvitations: false,
      }}
      side={isMobile ? "bottom" : "right"}
    />
  );
}
