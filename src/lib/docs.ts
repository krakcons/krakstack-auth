import {
  BookOpen,
  Boxes,
  Code2,
  FileJson,
  Globe2,
  KeyRound,
  Network,
  Paintbrush,
  ServerCog,
  Settings,
  ShieldCheck,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import {
  createDocsSource,
  makeDocs,
  type DocsPage,
} from "@krak-stack/registry/docs";

import { m } from "@/paraglide/messages";

export {
  createDocsSource,
  DocsPageSchema,
  makeDocs,
  slugifyDocsHeading,
  type DocsLocale,
  type DocsPage,
} from "@krak-stack/registry/docs";

const locales = ["en", "fr"] as const;

const icons = {
  "lucide:book-open": BookOpen,
  "lucide:boxes": Boxes,
  "lucide:code-2": Code2,
  "lucide:file-json": FileJson,
  "lucide:globe-2": Globe2,
  "lucide:key-round": KeyRound,
  "lucide:network": Network,
  "lucide:paintbrush": Paintbrush,
  "lucide:server-cog": ServerCog,
  "lucide:settings": Settings,
  "lucide:shield-check": ShieldCheck,
  "lucide:terminal": Terminal,
  "lucide:users": Users,
  "lucide:wrench": Wrench,
};

export const makeAuthDocs = (pages: ReadonlyArray<DocsPage>) =>
  makeDocs({
    source: createDocsSource({ pages, locales }),
    basePath: "/docs",
    defaultSlug: "introduction",
    origin: "https://auth.krakstack.net",
    siteName: "Krakstack Auth",
    icons,
    brand: {
      label: "Krakstack",
      subtitle: m.docs_brand_subtitle,
      icon: BookOpen,
      href: "/",
    },
    resources: {
      label: m.docs_resources,
      items: [
        {
          label: m.docs_home,
          href: "/",
        },
        {
          label: m.docs_api_reference,
          href: "/api/docs",
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

export type DocsCatalog = ReturnType<typeof makeAuthDocs>;

export const getDocsPages = createServerFn({ method: "GET" }).handler(
  async () => {
    const { loadMdxDocsDirectory } =
      await import("@krak-stack/registry/docs/server");
    return loadMdxDocsDirectory("src/content/docs");
  },
);
