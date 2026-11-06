import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult, AtomRegistry } from "effect/reactivity";
import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { projectsAtom } from "@/services/projects/client/atom";
import { ProjectEmailEditor } from "@/services/projects/client/email";
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
    <ProjectEmailEditor key={project.id} project={project} />
  ) : null;
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing regression fixture root");
createRoot(root).render(
  <RegistryContext.Provider value={AtomRegistry.make()}>
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  </RegistryContext.Provider>,
);
