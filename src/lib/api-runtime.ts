import { Atom } from "effect/reactivity";

import { BrowserOtlp } from "@krak-stack/registry/opentelemetry/browser";

export const apiRuntime = Atom.context();

if (!import.meta.env.SSR) {
  apiRuntime.addGlobalLayer(
    BrowserOtlp.layer({ serviceName: "krakstack-auth-web" }),
  );
}
