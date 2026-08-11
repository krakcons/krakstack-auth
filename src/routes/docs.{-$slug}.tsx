import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@krak-stack/registry/locale-switcher";
import {
  DocsNotFound,
  DocsPage,
  DocsLayout,
  docsSource,
  makeDocs,
  type DocsLocale,
} from "@/lib/docs";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const docsLocale = (): DocsLocale => (getLocale() === "fr" ? "fr" : "en");

const docs = makeDocs({
  source: docsSource,
  basePath: "/docs",
  defaultSlug: "introduction",
  origin: "https://auth.krakstack.net",
  siteName: "Krakstack Auth",
  brand: {
    label: "Krakstack",
    subtitle: m.docs_brand_subtitle,
    icon: "lucide:book-open",
    href: "/",
  },
  resources: {
    label: m.docs_resources,
    items: [
      {
        label: m.docs_home,
        href: "/",
        icon: "lucide:house",
      },
      {
        label: m.docs_api_reference,
        href: "/api/docs",
        icon: "lucide:file-json",
        external: true,
      },
    ],
  },
  sectionOrder: [
    "start",
    "integration",
    "frontend",
    "backend",
    "administration",
    "operations",
    "reference",
  ],
  github: {
    url: "https://github.com/krakcons/krakstack-auth",
    branch: "main",
  },
});

export const Route = createFileRoute("/docs/{-$slug}")({
  loader: ({ params }) => {
    const resolution = docs.resolve(params.slug, docsLocale());
    if (!resolution) throw notFound();

    if (!resolution.canonical) {
      throw redirect({ to: resolution.page.path, statusCode: 301 });
    }

    return resolution;
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.page.locale ?? docsLocale();
    return docs.getHead({
      locale,
      ...(loaderData?.page ? { page: loaderData.page } : {}),
    });
  },
  component: DocsRoutePage,
  notFoundComponent: () => <DocsNotFound docs={docs} locale={docsLocale()} />,
});

function DocsRoutePage() {
  const resolution = Route.useLoaderData();

  return (
    <DocsLayout
      docs={docs}
      locale={resolution.page.locale}
      headerActions={
        <>
          <ThemeToggle />
          <LocaleSwitcher />
        </>
      }
    >
      <DocsPage docs={docs} resolution={resolution} />
    </DocsLayout>
  );
}
