import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Users } from "lucide-react";

import { AppBrand } from "@/components/ui/app-brand";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { normalizeAuthHost } from "@/lib/domain-utils";
import { m } from "@/paraglide/messages";
import {
  getBrowserAuthHost,
  getOAuthClientIdFromSearch,
  getProjectIdFromSearch,
  useProjectPublicConfigSuspense,
} from "@/services/auth/client/atoms";
import { AuthBrandingProvider } from "@/services/auth/client/branding";

const getAuthHost = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  return (
    normalizeAuthHost(
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    ) ?? normalizeAuthHost(request.url)
  );
});

export const Route = createFileRoute("/_auth")({
  loader: () => getAuthHost(),
  component: AuthLayout,
});

function AuthLayout() {
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const serverHost = Route.useLoaderData();
  const projectId = getProjectIdFromSearch(searchString);
  const clientId = getOAuthClientIdFromSearch(searchString);
  const projectConfig = useProjectPublicConfigSuspense(
    projectId,
    clientId,
    serverHost ?? getBrowserAuthHost(),
  );

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
          {...(projectConfig?.logoUrl
            ? { imageSrc: projectConfig.logoUrl }
            : {})}
        />
      </div>
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <LocaleToggle />
      </div>
      <AuthBrandingProvider value={projectConfig}>
        <div className="flex w-full flex-col items-center">
          <Outlet />
        </div>
      </AuthBrandingProvider>
    </main>
  );
}
