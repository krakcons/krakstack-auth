import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  BookOpen,
  Boxes,
  Code2,
  ExternalLink,
  Globe2,
  House,
  KeyRound,
  Network,
  Paintbrush,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";

import { ThemeToggle } from "@/components/theme-toggle";
import { AppBrand } from "@/components/ui/app-brand";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { SidebarLayout, type NavGroup } from "@/components/ui/sidebar-layout";
import { getDocsPage, getLocalizedDocsPages } from "@/lib/docs";
import { getLocale } from "@/paraglide/runtime";

const iconForName = (name: string) => {
  switch (name) {
    case "boxes":
      return Boxes;
    case "globe":
      return Globe2;
    case "key":
      return KeyRound;
    case "network":
      return Network;
    case "paintbrush":
      return Paintbrush;
    case "server":
      return ServerCog;
    case "shield":
      return ShieldCheck;
    default:
      return BookOpen;
  }
};

const docsLocale = () => (getLocale() === "fr" ? "fr" : "en");

export const Route = createFileRoute("/docs/{-$slug}")({
  loader: ({ params }) => {
    const page = getDocsPage(params.slug ?? "introduction", docsLocale());
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Documentation"} | Krakstack Auth` },
      {
        name: "description",
        content: loaderData?.description ?? "Krakstack Auth documentation",
      },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const page = Route.useLoaderData();
  const locale = docsLocale();
  const pages = getLocalizedDocsPages(locale);
  const pageItem = (item: (typeof pages)[number]) => ({
    label: () => item.title,
    href: item.path,
    icon: iconForName(item.icon),
  });
  const pagesFor = (slugs: ReadonlySet<string>) =>
    pages.filter((item) => slugs.has(item.slug)).map(pageItem);
  const groups: NavGroup[] = [
    {
      label: () => (locale === "fr" ? "Aperçu" : "Overview"),
      items: pagesFor(new Set(["introduction", "setup"])),
    },
    {
      label: () => (locale === "fr" ? "Intégration" : "Integration"),
      items: pagesFor(new Set(["proxy", "oauth", "subdomain"])),
    },
    {
      label: () => (locale === "fr" ? "Interface" : "Frontend"),
      items: pagesFor(new Set(["components", "auth-pages"])),
    },
    {
      label: () => (locale === "fr" ? "Serveur" : "Backend"),
      items: pagesFor(new Set(["middleware", "domains"])),
    },
    {
      label: () => (locale === "fr" ? "Exploitation" : "Operations"),
      items: pagesFor(new Set(["self-hosting", "security"])),
    },
    {
      label: () => (locale === "fr" ? "Ressources" : "Resources"),
      items: [
        {
          label: () => (locale === "fr" ? "Accueil" : "Home"),
          href: "/",
          icon: House,
        },
        {
          label: () => "GitHub",
          href: "https://github.com/krakcons/krakstack-auth",
          icon: Code2,
          external: true,
        },
      ],
    },
  ];

  return (
    <SidebarLayout
      groups={groups}
      sidebarHeader={
        <AppBrand
          label="Krakstack"
          subtitle="Auth Docs"
          icon={BookOpen}
          href="/"
          variant="sidebar"
        />
      }
      headerActions={
        <>
          <a
            className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-sm sm:flex"
            href="https://github.com/krakcons/krakstack-auth"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ExternalLink className="size-3.5" />
          </a>
          <ThemeToggle />
          <LocaleSwitcher />
        </>
      }
    >
      <main className="mx-auto w-full max-w-4xl pb-16">
        <div className="mb-8 border-b pb-8">
          <p className="text-primary mb-3 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
            {locale === "fr" ? "Guide Krakstack Auth" : "Krakstack Auth guide"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {page.title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
            {page.description}
          </p>
        </div>
        <Streamdown
          className="[&_a:hover]:text-primary [&_a]:underline-offset-4 [&_h1:first-child]:hidden [&_pre]:border [&_table]:text-sm"
          mode="static"
          plugins={{ code }}
        >
          {page.source}
        </Streamdown>
      </main>
    </SidebarLayout>
  );
}
