import { BrowserCrypto } from "@effect/platform-browser";
import { Events } from "@krak-stack/registry/events";
import { Otlp } from "@krak-stack/registry/opentelemetry";
import { ConfigProvider, Layer, Redacted, References } from "effect";
import { sqlTestLayer } from "@/services/database";

const eventsLayer = Events.layerWith({
  origin: "https://auth.example.test",
  secret: Redacted.make("test-events-secret-at-least-32-characters"),
  serviceName: "auth-audit-test",
  requireConsent: false,
}).pipe(
  Layer.provide(BrowserCrypto.layer),
  Layer.provide(
    Otlp.layer.pipe(
      Layer.provide(
        ConfigProvider.layerAdd(
          ConfigProvider.fromUnknown({
            OTEL_SERVICE_NAME: "auth-audit-test",
            OTEL_SDK_DISABLED: "true",
          }),
        ),
      ),
    ),
  ),
  Layer.provide(sqlTestLayer),
);

export const testEventsLayer = Layer.merge(
  eventsLayer,
  Layer.succeed(References.CurrentLogAnnotations, {
    "app.actor.type": "system",
    "app.actor.id": "vitest",
  }),
);
