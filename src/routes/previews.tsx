import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  KrakstackAuthProvider,
  OrganizationSwitcher,
  UserButton,
} from "@krak-stack/auth";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@krak-stack/registry/locale-switcher";
import { m } from "@/paraglide/messages";
import { authBaseUrl, authClient } from "@/services/auth/client";

const previewApiKeyPermissions = {
  projects: ["read", "create", "update", "delete"],
  users: ["read", "invite", "update"],
  billing: ["read", "manage"],
} as const;

export const Route = createFileRoute("/previews")({
  ssr: false,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: AuthPreviews,
});

function AuthPreviews() {
  const projectId = import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID;

  return (
    <KrakstackAuthProvider
      authClient={authClient}
      baseUrl={authBaseUrl}
      {...(projectId ? { projectId } : {})}
    >
      <main className="bg-muted/30 relative flex min-h-screen justify-center overflow-hidden px-4 pt-20 pb-10 sm:px-6">
        <div className="absolute top-4 right-4 flex items-center gap-2 sm:top-6 sm:right-6">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
        <div className="flex w-full max-w-xl flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{m.organization_switcher_preview_title()}</CardTitle>
              <CardDescription>
                {m.organization_switcher_preview_description()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <OrganizationSwitcher
                  authClient={authClient}
                  baseUrl={authBaseUrl}
                  className="w-full max-w-xs min-w-0"
                  apiKeyPermissions={previewApiKeyPermissions}
                  renderUnauthenticated={PreviewSignIn}
                />
                <UserButton
                  authClient={authClient}
                  baseUrl={authBaseUrl}
                  apiKeyPermissions={previewApiKeyPermissions}
                />
              </div>
            </CardContent>
          </Card>
          <FiveOrganizationSwitcherPreview />
        </div>
      </main>
    </KrakstackAuthProvider>
  );
}

function FiveOrganizationSwitcherPreview() {
  const organizations = authClient.useListOrganizations();
  const activeOrganization = authClient.useActiveOrganization();
  const allowedOrganizationIds = organizations.data
    ? [
        ...(activeOrganization.data ? [activeOrganization.data.id] : []),
        ...organizations.data
          .filter(
            (organization) => organization.id !== activeOrganization.data?.id,
          )
          .map((organization) => organization.id),
      ].slice(0, 6)
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.organization_switcher_five_preview_title()}</CardTitle>
        <CardDescription>
          {m.organization_switcher_five_preview_description()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationSwitcher
          authClient={authClient}
          baseUrl={authBaseUrl}
          className="w-full max-w-xs min-w-0"
          apiKeyPermissions={previewApiKeyPermissions}
          {...(allowedOrganizationIds ? { allowedOrganizationIds } : {})}
          renderUnauthenticated={() => null}
        />
      </CardContent>
    </Card>
  );
}

function PreviewSignIn() {
  return (
    <a className={buttonVariants()} href="/sign-in?callbackURL=%2Fpreviews">
      {m.auth_sign_in()}
    </a>
  );
}
