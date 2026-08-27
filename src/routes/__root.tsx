import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { QueryStandard } from "@krak-stack/registry/query";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@krak-stack/registry/theme-switcher";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import appCss from "../styles.css?url";

const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  validateSearch: QueryStandard,
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
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
