import { Atom } from "effect/reactivity";

import { BrowserOtlp } from "@krak-stack/registry/opentelemetry/browser";
import { BrowserEvents } from "@krak-stack/registry/events/browser";
import { BrowserWebVitals } from "@krak-stack/registry/opentelemetry/web-vitals";
import { Layer } from "effect";

export const apiRuntime = Atom.context();

if (!import.meta.env.SSR) {
  apiRuntime.addGlobalLayer(
    Layer.mergeAll(BrowserEvents.layer(), BrowserWebVitals.layer()).pipe(
      Layer.provideMerge(
        BrowserOtlp.layer({ serviceName: "krakstack-auth-web" }),
      ),
    ),
  );
}
