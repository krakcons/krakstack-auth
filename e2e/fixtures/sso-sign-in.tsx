import { RegistryContext } from "@effect/atom-react";
import { Signin } from "@krak-stack/auth/components";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AtomRegistry } from "effect/reactivity";
import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { setLocale } from "@/paraglide/runtime";
import "../../src/styles.css";

await setLocale("en", { reload: false });
const rootRoute = createRootRoute({ component: () => <Outlet /> });
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: () => <Signin baseUrl="http://127.0.0.1:4179" />,
});
const completeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sso-complete",
  component: () => <p role="status">SSO redirect requested</p>,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([signInRoute, completeRoute]),
  history: createMemoryHistory({ initialEntries: ["/sign-in"] }),
});
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <RegistryContext.Provider value={AtomRegistry.make()}>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </RegistryContext.Provider>,
);
