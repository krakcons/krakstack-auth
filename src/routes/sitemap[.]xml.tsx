import { createFileRoute } from "@tanstack/react-router";

import { makeAuthDocs } from "@/lib/docs";

const origin = "https://auth.krakstack.net";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const sitemap = async () => {
  const { loadMdxDocsDirectory } =
    await import("@krak-stack/registry/docs/server");
  const docs = makeAuthDocs(await loadMdxDocsDirectory("src/content/docs"));
  const pages = docs.pages("en");
  const paths = ["/", ...pages.map((page) => page.path)];
  const urls = paths.flatMap((path) =>
    (["en", "fr"] as const).map((locale) => {
      const location = `${origin}/${locale}${path}`;
      return `  <url>
    <loc>${escapeXml(location)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(`${origin}/en${path}`)}" />
    <xhtml:link rel="alternate" hreflang="fr" href="${escapeXml(`${origin}/fr${path}`)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}/en${path}`)}" />
  </url>`;
    }),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(await sitemap(), {
          headers: {
            "cache-control": "public, max-age=3600",
            "content-type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
});
