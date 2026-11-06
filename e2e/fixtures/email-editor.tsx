import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult, AtomRegistry } from "effect/reactivity";
import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { projectsAtom } from "@/services/projects/client/atom";
import { ProjectEmailEditor } from "@/services/projects/client/email";
import { ProjectForm } from "@/services/projects/client/form";
import { setLocale } from "@/paraglide/runtime";
import "../../src/styles.css";

const locale = Schema.decodeUnknownSync(Schema.Literals(["en", "fr"]))(
  new URLSearchParams(location.search).get("locale") ?? "en",
);
await setLocale(locale, { reload: false });

const Editor = () => {
  const result = useAtomValue(projectsAtom);
  const project = AsyncResult.getOrElse(result, () => [])[0];
  return project ? (
    <>
      <button type="button" onClick={() => router.history.push("/left")}>
        Leave editor
      </button>
      {new URLSearchParams(location.search).get("settings") === "full" ? (
        <ProjectForm key={`form-${project.id}`} project={project} inline />
      ) : null}
      <ProjectEmailEditor key={project.id} project={project} />
    </>
  ) : null;
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing regression fixture root");
const rootRoute = createRootRoute({ component: Outlet });
const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/e2e/fixtures/email-editor.html",
  component: Editor,
});
const leftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/left",
  component: () => <p>Left editor</p>,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([editorRoute, leftRoute]),
});
createRoot(root).render(
  <RegistryContext.Provider value={AtomRegistry.make()}>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </RegistryContext.Provider>,
);
