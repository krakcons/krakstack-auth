import { BrowserCrypto } from "@effect/platform-browser";
import { Events } from "@krak-stack/registry/events";
import { Otlp } from "@krak-stack/registry/opentelemetry";
import { Layer, ManagedRuntime } from "effect";
import { sqlLayer } from "@/services/database";

export const auditEventsLayer = Events.layerWith({
  geolocation: "cloudflare",
  requireConsent: false,
}).pipe(
  Layer.provide(BrowserCrypto.layer),
  Layer.provide(sqlLayer),
  Layer.provideMerge(Otlp.layer),
);

// Native Better Auth hooks execute outside the HttpApi Effect runtime.
export const nativeAuditRuntime = ManagedRuntime.make(auditEventsLayer);
