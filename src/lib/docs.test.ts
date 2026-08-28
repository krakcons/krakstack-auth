import { describe, expect, it } from "@effect/vitest";

import { createDocsSource, makeAuthDocs, slugifyDocsHeading } from "./docs";
import { loadMdxDocsDirectory } from "@krak-stack/registry/docs/server";

const loadDocsSource = async () =>
  createDocsSource({
    pages: await loadMdxDocsDirectory("src/content/docs"),
    locales: ["en", "fr"],
  });

describe("documentation catalog", () => {
  it("keeps English and French metadata aligned", async () => {
    const docsSource = await loadDocsSource();
    const english = docsSource.getPages("en");
    const french = docsSource.getPages("fr");

    expect(english.map(({ slug }) => slug)).toEqual(
      french.map(({ slug }) => slug),
    );
    expect(english.map(({ order }) => order)).toEqual(
      french.map(({ order }) => order),
    );
    for (const page of english) {
      const translated = french.find(({ slug }) => slug === page.slug);
      expect(
        page.headings.map(({ depth }) => depth),
        page.sourceFile,
      ).toEqual(translated?.headings.map(({ depth }) => depth));
    }
  });

  it("creates stable ASCII heading IDs", () => {
    expect(slugifyDocsHeading("Sécurité et exploitation")).toBe(
      "securite-et-exploitation",
    );
    expect(slugifyDocsHeading("OAuth / OpenID Connect")).toBe(
      "oauth-openid-connect",
    );
  });

  it("resolves page neighbors in global order", async () => {
    const docsSource = await loadDocsSource();
    const first = docsSource.getPageNeighbors("introduction", "en");
    const quickstart = docsSource.getPageNeighbors("quickstart", "en");

    expect(first.previous).toBeUndefined();
    expect(first.next?.slug).toBe("quickstart");
    expect(quickstart.previous?.slug).toBe("introduction");
    expect(quickstart.next?.slug).toBe("setup");
  });

  it("keeps the public access-control alias", async () => {
    const docsSource = await loadDocsSource();
    expect(docsSource.resolvePage("access-control", "en")?.slug).toBe("rbac");
    expect(docsSource.getPage("rbac", "en")?.path).toBe("/docs/rbac");
  });

  it("applies project route, ordering, origin, and repository configuration", async () => {
    const docsSource = await loadDocsSource();
    const configured = makeAuthDocs(docsSource.pages);
    const introduction = docsSource.getPage("introduction", "en");

    expect(configured.sections("en")[0]?.id).toBe("start");
    expect(configured.resolve(undefined, "en")?.page.slug).toBe("introduction");
    expect(configured.resolve("access-control", "en")?.canonical).toBe(false);
    expect(configured.getMessages("fr").previous).toBe("Précédent");
    const searchResults = configured.search("oauth", "en", {
      limit: 3,
    });
    expect(searchResults.length).toBeLessThanOrEqual(3);
    expect(searchResults.some(({ page }) => page.slug === "oauth")).toBe(true);
    expect(introduction && configured.url(introduction, "en")).toBe(
      "https://auth.krakstack.net/en/docs",
    );
    expect(introduction && configured.editUrl(introduction)).toBe(
      "https://github.com/krakcons/krakstack-auth/edit/main/src/content/docs/en/introduction.mdx",
    );
    expect(
      (introduction
        ? configured.getHead({ locale: "en", page: introduction })
        : configured.getHead({ locale: "en" })
      ).meta,
    ).toContainEqual({
      title: `${introduction?.title ?? "Documentation"} | Krakstack Auth`,
    });
  });

  it("accepts provider-supplied page records", async () => {
    const docsSource = await loadDocsSource();
    const source = createDocsSource({
      pages: docsSource.pages,
      locales: ["en", "fr"],
    });

    expect(source.getPage("introduction", "en")?.title).toBe(
      docsSource.getPage("introduction", "en")?.title,
    );
    expect(source.locales).toEqual(["en", "fr"]);
  });

  it("resolves every internal documentation link", async () => {
    const docsSource = await loadDocsSource();
    const slugs = new Set(docsSource.getPages("en").map(({ slug }) => slug));

    for (const page of docsSource.pages) {
      for (const match of page.source.matchAll(/\]\(\/docs(?:\/([^#)]+))?/g)) {
        const slug = match[1] ?? "introduction";
        expect(slugs.has(slug), `${page.sourceFile}: ${slug}`).toBe(true);
      }
    }
  });

  it("provides unique heading IDs without body-level H1s", async () => {
    const docsSource = await loadDocsSource();
    for (const page of docsSource.pages) {
      expect(page.source).not.toMatch(/^#\s/m);
      const ids = page.headings.map(({ id }) => id);
      expect(new Set(ids).size, page.sourceFile).toBe(ids.length);
    }
  });
});
