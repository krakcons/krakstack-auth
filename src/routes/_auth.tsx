import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  KrakstackAuthProvider,
  useKrakstackAuthProjectConfig,
} from "@krak-stack/auth/components";
import { Users } from "lucide-react";

import { AppBrand } from "@krak-stack/registry/app-brand";
import { LocaleSwitcher } from "@krak-stack/registry/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { m } from "@/paraglide/messages";
import { AuthBrandingProvider } from "@/services/auth/client/branding";

export const Route = createFileRoute("/_auth")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  const projectId = import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID;

  return (
    <KrakstackAuthProvider {...(projectId ? { projectId } : {})}>
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
        {brandHref ? (
          <AppBrand
            label={projectConfig?.name ?? m.sidebar_brand()}
            subtitle={m.sidebar_brand_subtitle()}
            icon={Users}
            href={brandHref}
            {...(projectConfig?.logoUrl
              ? { imageSrc: projectConfig.logoUrl }
              : {})}
          />
        ) : (
          <AppBrand
            label={projectConfig?.name ?? m.sidebar_brand()}
            subtitle={m.sidebar_brand_subtitle()}
            icon={Users}
            to={null}
            {...(projectConfig?.logoUrl
              ? { imageSrc: projectConfig.logoUrl }
              : {})}
          />
        )}
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
