import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime.js";
import { RegistryContext } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";

export function getRouter() {
  const registry = AtomRegistry.make({ defaultIdleTTL: 400 });

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    context: { registry },
    Wrap: ({ children }) => (
      <RegistryContext.Provider value={registry}>
        {children}
      </RegistryContext.Provider>
    ),
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
