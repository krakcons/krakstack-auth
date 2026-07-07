import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  optimizeDeps: {
    exclude: [
      "@aws-sdk/credential-provider-web-identity",
      "@aws-sdk/credential-providers",
      "@distilled.cloud/aws",
    ],
  },
  resolve: {
    alias: [
      {
        find: /^@krak-stack\/auth$/,
        replacement: fileURLToPath(
          new URL("./packages/sdk/src/components/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@krak-stack\/auth\/schema$/,
        replacement: fileURLToPath(
          new URL("./packages/sdk/src/schema.ts", import.meta.url),
        ),
      },
      {
        find: /^@krak-stack\/auth\/admin$/,
        replacement: fileURLToPath(
          new URL("./packages/sdk/src/admin/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@krak-stack\/auth\/api$/,
        replacement: fileURLToPath(
          new URL("./packages/sdk/src/api.ts", import.meta.url),
        ),
      },
      {
        find: /^@krak-stack\/auth\/query$/,
        replacement: fileURLToPath(
          new URL("./packages/sdk/src/query.ts", import.meta.url),
        ),
      },
      {
        find: /^@krak-stack\/auth\/server$/,
        replacement: fileURLToPath(
          new URL("./packages/sdk/src/server/index.ts", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
    tsconfigPaths: true,
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    allowedHosts: [".kokobi.test"],
    cors: false,
  },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
      cookieName: "locale",
      urlPatterns: [
        {
          pattern: "/:path(.*)?",
          localized: [
            ["en", "/en/:path(.*)?"],
            ["fr", "/fr/:path(.*)?"],
          ],
        },
      ],
      routeStrategies: [
        { match: "/api/:path(.*)?", exclude: true },
        { match: "/.well-known/:path(.*)?", exclude: true },
      ],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
