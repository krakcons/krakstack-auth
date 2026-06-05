import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { Users } from "lucide-react";

import { AppBrand } from "@/components/app-brand";
import { LocaleToggle } from "@/components/locale-toggle";
import { m } from "@/paraglide/messages";
import {
  getOAuthClientIdFromSearch,
  useOAuthClientConfigSuspense,
} from "@/services/auth/client/atoms";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const clientId = getOAuthClientIdFromSearch(searchString);
  const clientConfig = useOAuthClientConfigSuspense(clientId);

  return (
    <main
      className="relative grid min-h-screen place-items-center px-6 py-10"
      data-oauth-client-theme={clientConfig?.clientId}
    >
      {clientConfig?.themeCss ? (
        <style dangerouslySetInnerHTML={{ __html: clientConfig.themeCss }} />
      ) : null}
      <div className="absolute top-6 left-6 md:top-10 md:left-10">
        <AppBrand
          label={clientConfig?.name ?? m.sidebar_brand()}
          subtitle={m.sidebar_brand_subtitle()}
          icon={Users}
          logoUrl={clientConfig?.logoUrl}
        />
      </div>
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <LocaleToggle />
      </div>
      <div className="flex w-full flex-col items-center">
        <Outlet />
      </div>
    </main>
  );
}
