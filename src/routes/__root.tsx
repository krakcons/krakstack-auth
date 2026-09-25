import {
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Suspense } from "react";
import { KrakstackAuthProvider } from "@krak-stack/auth/components";
import {
  ErrorComponent,
  type ErrorComponentProps,
} from "@krak-stack/registry/error-component";
import { Loading } from "@krak-stack/registry/loading";
import { authBaseUrl } from "@/services/auth/client";
import { authAccessLabels } from "@/services/auth/access-labels";

import { ThemeProvider } from "@krak-stack/registry/theme-switcher";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import appCss from "../styles.css?url";

const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

const AppErrorComponent = (props: ErrorComponentProps) => (
  <ErrorComponent
    {...props}
    diagnostics={{ app: m.app_name() }}
    messages={{
      title: m.error_page_title(),
      description: m.error_page_description(),
    }}
  />
);

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: m.app_name(),
      },
      {
        name: "application-name",
        content: m.app_name(),
      },
      {
        name: "theme-color",
        content: "#6f5c51",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap",
      },
    ],
    scripts: analyticsWebsiteId
      ? [
          {
            defer: true,
            src: "https://analytics.krakconsultants.net/script.js",
            "data-website-id": analyticsWebsiteId,
          },
        ]
      : [],
  }),
  shellComponent: RootDocument,
  errorComponent: AppErrorComponent,
  component: RootContent,
});

function RootContent() {
  const needsAuth = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId === "/_auth" ||
          match.routeId === "/admin" ||
          match.routeId === "/previews",
      ),
  });

  if (!needsAuth) return <Outlet />;

  const projectId = import.meta.env.VITE_KRAKSTACK_AUTH_PROJECT_ID;
  const loading = <Loading variant="centered" />;

  return (
    <ClientOnly fallback={loading}>
      <Suspense fallback={loading}>
        <KrakstackAuthProvider
          locale={getLocale()}
          baseUrl={authBaseUrl}
          accessLabels={authAccessLabels()}
          {...(projectId ? { projectId } : {})}
        >
          <Outlet />
        </KrakstackAuthProvider>
      </Suspense>
    </ClientOnly>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
