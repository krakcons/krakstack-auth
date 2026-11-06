import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: false,
  cacheDir: "./tmp/e2e-vite",
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@/paraglide": fileURLToPath(
        new URL("../tmp/e2e-paraglide", import.meta.url),
      ),
    },
  },
  define: {
    "import.meta.env.VITE_KRAKSTACK_AUTH_URL": JSON.stringify(
      "http://127.0.0.1:4179",
    ),
    "import.meta.env.VITE_SITE_URL": JSON.stringify("http://127.0.0.1:4179"),
  },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./tmp/e2e-paraglide",
      strategy: ["cookie", "baseLocale"],
      cookieName: "locale",
    }),
    tailwindcss(),
    viteReact(),
  ],
  server: { host: "127.0.0.1", port: 4179, strictPort: true },
});
