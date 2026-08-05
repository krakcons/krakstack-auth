import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  KrakstackAuthProvider,
  useKrakstackAuthProjectConfig,
} from "@krak-stack/auth";
import { Users } from "lucide-react";

import { AppBrand } from "@/components/ui/app-brand";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { m } from "@/paraglide/messages";
import { authClient } from "@/services/auth/client";
import { AuthBrandingProvider } from "@/services/auth/client/branding";

export const Route = createFileRoute("/_auth")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const projectId = import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID;

  return (
    <KrakstackAuthProvider
      authClient={authClient}
      {...(projectId ? { projectId } : {})}
    >
      <AuthLayoutContent />
    </KrakstackAuthProvider>
  );
}

function AuthLayoutContent() {
  const projectConfig = useKrakstackAuthProjectConfig();
  const brandHref = projectConfig?.rootDomain
    ? `//${projectConfig.rootDomain}`
    : undefined;

  return (
    <main
      className="relative grid min-h-screen place-items-center px-6 py-10"
      data-project-theme={projectConfig?.projectKey}
    >
      {projectConfig?.themeCss ? (
        <style dangerouslySetInnerHTML={{ __html: projectConfig.themeCss }} />
      ) : null}
      <div className="absolute top-6 left-6 md:top-10 md:left-10">
        <AppBrand
          label={projectConfig?.name ?? m.sidebar_brand()}
          subtitle={m.sidebar_brand_subtitle()}
          icon={Users}
          {...(brandHref ? { href: brandHref } : {})}
          {...(projectConfig?.logoUrl
            ? { imageSrc: projectConfig.logoUrl }
            : {})}
        />
      </div>
      <div className="absolute top-6 right-6 flex items-center gap-2 md:top-10 md:right-10">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <AuthBrandingProvider value={projectConfig}>
        <div className="flex w-full flex-col items-center">
          <Outlet />
        </div>
      </AuthBrandingProvider>
    </main>
  );
}
