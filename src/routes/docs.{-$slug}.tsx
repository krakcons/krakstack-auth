import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@krak-stack/registry/locale-switcher";
import {
  DocsNotFound,
  DocsPage,
  DocsLayout,
  type DocsLocale,
} from "@krak-stack/registry/docs";
import { getDocsPages, makeAuthDocs } from "@/lib/docs";
import { getLocale } from "@/paraglide/runtime";

const docsLocale = (): DocsLocale => (getLocale() === "fr" ? "fr" : "en");

const docsShell = makeAuthDocs([]);

export const Route = createFileRoute("/docs/{-$slug}")({
  loader: async ({ params }) => {
    const pages = await getDocsPages();
    const docs = makeAuthDocs(pages);
    const resolution = docs.resolve(params.slug, docsLocale());
    if (!resolution) throw notFound();

    if (!resolution.canonical) {
      throw redirect({ to: resolution.page.path, statusCode: 301 });
    }

    return { pages, resolution };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.resolution.page.locale ?? docsLocale();
    const docs = loaderData ? makeAuthDocs(loaderData.pages) : docsShell;
    return loaderData?.resolution.page
      ? docs.getHead({ locale, page: loaderData.resolution.page })
      : docs.getHead({ locale });
  },
  component: DocsRoutePage,
  notFoundComponent: () => (
    <DocsNotFound docs={docsShell} locale={docsLocale()} />
  ),
});

function DocsRoutePage() {
  const { pages, resolution } = Route.useLoaderData();
  const docs = makeAuthDocs(pages);

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
