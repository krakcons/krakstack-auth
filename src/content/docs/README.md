# Documentation Authoring

Public documentation lives in paired files under `en/` and `fr/`. A page is not complete until both locales ship together.

## Frontmatter

Every page requires:

```yaml
slug: example
path: /docs/example
title: Example
description: One sentence used in navigation, search, and metadata.
icon: lucide:book-open
order: 10
locale: en
section: start
type: how-to
legacySlugs: [old-example]
```

The loader validates Iconify icon names, page types, positive unique order values, canonical paths, locale directories, aliases, and English/French metadata parity. Sections are arbitrary stable IDs and appear in the order of their first page.

## Project Configuration

The route creates a project-specific catalog with `makeDocs`:

```ts
const docs = makeDocs({
  source: docsSource,
  basePath: "/docs",
  defaultSlug: "introduction",
  origin: "https://docs.example.com",
  siteName: "Example Docs",
  brand: {
    label: "Example",
    subtitle: () => "Documentation",
    icon: "lucide:book-open",
    href: "/",
  },
  sectionOrder: ["start", "reference"],
  github: {
    url: "https://github.com/example/project",
    branch: "main",
  },
});
```

Raw content is supplied separately through a provider-agnostic source:

```ts
const docsSource = createMdxDocsSource({
  files: import.meta.glob("../content/docs/**/*.mdx", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
  locales: ["en", "fr"],
});
```

Any build integration can provide the `files` record; the catalog does not depend on a filesystem. Other content providers can call `createDocsSource({ pages, locales })` directly with records matching `DocsPageSchema`, bypassing the MDX adapter. Change these objects when upstreaming the route to another project. The catalog uses them for parsing, locale validation, canonical resolution, aliases, section ordering, localized canonical URLs, and edit links.

The route owns its loader, redirects, and TanStack registration. Compose the exported views explicitly:

```tsx
<DocsLayout
  docs={docs}
  locale={resolution.page.locale}
  headerActions={<ThemeToggle />}
>
  <DocsPage docs={docs} resolution={resolution} />
</DocsLayout>
```

`DocsLayout`, `DocsPage`, and `DocsNotFound` use the built-in English or French messages. Optional message overrides, branding, resources, and the GitHub label belong to the `makeDocs` configuration. Use `docs.getHead(...)` in the route head callback; it derives messages, site name, origin, supported locales, default locale, and the canonical path from the catalog.

## Page Types

| Type        | Required shape                                                       |
| ----------- | -------------------------------------------------------------------- |
| `tutorial`  | Outcome, prerequisites, complete steps, verification, next task      |
| `how-to`    | Goal, assumptions, procedure, validation, common failures            |
| `reference` | Exact contract, defaults, security boundary, errors, source of truth |
| `concept`   | Context, terminology, architecture, trade-offs, related tasks        |
| `runbook`   | Trigger, prerequisites, procedure, validation, recovery or rollback  |

## Content Rules

- Keep one H1 matching the frontmatter title. The renderer removes it because the route owns the visible H1.
- Use H2 and H3 headings with unique text so stable anchors can be generated.
- Store internal links as unlocalized `/docs/...` paths. TanStack Router and Paraglide localize them at render time.
- Prefer links to canonical pages over copying configuration or security guidance.
- Keep code identifiers, routes, and environment variables unchanged in French.
- Add warnings next to the action they constrain.
- Do not document a generated endpoint manually when `/api/docs` is authoritative.
- Validate technical claims against current package exports, runtime middleware, and deployment configuration.

## Checks

`src/lib/docs.test.ts` verifies locale parity, ordering, internal links, heading IDs, body structure, and legacy aliases. Run:

```bash
bun run test src/lib/docs.test.ts
bun type:check
bun lint
bun run build
```
