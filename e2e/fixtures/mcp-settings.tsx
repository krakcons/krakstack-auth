import { RegistryContext } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";
import { createRoot } from "react-dom/client";
import { ProjectMcpSettings } from "@/services/project-mcp/client/form";
import { setLocale } from "@/paraglide/runtime";
import "../../src/styles.css";

await setLocale("en", { reload: false });
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <RegistryContext.Provider value={AtomRegistry.make()}>
    <ProjectMcpSettings projectId="test-project" />
  </RegistryContext.Provider>,
);
