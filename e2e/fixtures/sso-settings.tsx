import { RegistryContext } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";
import { createRoot } from "react-dom/client";
import { OrganizationSwitcher } from "@/services/auth/client/organization-switcher";
import { setLocale } from "@/paraglide/runtime";
import "../../src/styles.css";

await setLocale("en", { reload: false });
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <RegistryContext.Provider value={AtomRegistry.make()}>
    <OrganizationSwitcher
      baseUrl="http://127.0.0.1:4179"
      features={{ organizationCreation: false, userInvitations: false }}
    />
  </RegistryContext.Provider>,
);
