import { createFileRoute } from "@tanstack/react-router";

import { docsSource } from "@/lib/docs";

const origin = "https://auth.krakstack.net";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const sitemap = () => {
  const pages = docsSource.getPages("en");
  const urls = pages.flatMap((page) =>
    (["en", "fr"] as const).map((locale) => {
      const location = `${origin}/${locale}${page.path}`;
      return `  <url>
    <loc>${escapeXml(location)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(`${origin}/en${page.path}`)}" />
    <xhtml:link rel="alternate" hreflang="fr" href="${escapeXml(`${origin}/fr${page.path}`)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}/en${page.path}`)}" />
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
      GET: () =>
        new Response(sitemap(), {
          headers: {
            "cache-control": "public, max-age=3600",
            "content-type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
});
