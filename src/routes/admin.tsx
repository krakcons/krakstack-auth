import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import {
  KeyRound,
  KeySquare,
  LayoutDashboard,
  Loader2,
  Building2,
  FolderKanban,
  Globe2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { m } from "@/paraglide/messages";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarLayout, type NavGroup } from "@/components/ui/sidebar-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  authBaseUrl,
  authClient,
  ensureKrakOrganizationSelected,
} from "@/services/auth/client";
import {
  KrakstackAuthProvider,
  OrganizationSwitcher,
  UserButton,
} from "@krak-stack/auth";
import type { AuthSession } from "@/services/auth/config";

type SessionData = AuthSession | null;

const isAdminUser = (user: AuthSession["user"] | undefined) => {
  const role = (user as Record<string, unknown> | undefined)?.role;

  return (
    typeof role === "string" &&
    role.split(",").some((item) => item.trim() === "admin")
  );
};

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession({
      query: { disableCookieCache: true },
    });

    if (!session.data?.user) {
      throw redirect({ to: "/sign-in" });
    }

    await ensureKrakOrganizationSelected();
  },
  component: Admin,
});

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

function Admin() {
  const session = authClient.useSession();
  const [refreshedSession, setRefreshedSession] = useState<SessionData>(null);
  const [isRefreshingSession, setIsRefreshingSession] = useState(true);

  useEffect(() => {
    let isActive = true;

    void authClient
      .getSession({ query: { disableCookieCache: true } })
      .then((result) => {
        if (!isActive) return;
        setRefreshedSession(result.data ?? null);
      })
      .finally(() => {
        if (!isActive) return;
        setIsRefreshingSession(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const currentSession = refreshedSession ?? session.data ?? null;
  const user = currentSession?.user;
  const isAdmin = isAdminUser(user);

  if (session.isPending || isRefreshingSession) {
    return (
      <main className="grid min-h-screen place-items-center px-6 py-10">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" data-icon="inline-start" />
          {m.admin_checking_access()}
        </div>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <KrakstackAuthProvider
        authClient={authClient}
        baseUrl={authBaseUrl}
        projectId={import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID}
      >
        <AdminAccessDenied isSignedIn={!!user} />
      </KrakstackAuthProvider>
    );
  }

  return (
    <KrakstackAuthProvider
      authClient={authClient}
      baseUrl={authBaseUrl}
      projectId={import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID}
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
    </KrakstackAuthProvider>
  );
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

function AdminAccessDenied({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <div className="absolute top-6 right-6 flex items-center gap-2 md:top-10 md:right-10">
        <ThemeToggle />
        <LocaleSwitcher />
        {isSignedIn ? (
          <UserButton authClient={authClient} baseUrl={authBaseUrl} />
        ) : null}
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="bg-destructive/10 text-destructive mb-2 flex size-10 items-center justify-center rounded-md">
            <ShieldAlert />
          </div>
          <CardTitle>{m.admin_access_required()}</CardTitle>
          <CardDescription>
            {isSignedIn ? m.admin_no_permission() : m.admin_sign_in_first()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{m.admin_mistake()}</p>
        </CardContent>
        {!isSignedIn ? (
          <CardFooter>
            <Button render={<Link to="/sign-in" />}>{m.auth_sign_in()}</Button>
          </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}
