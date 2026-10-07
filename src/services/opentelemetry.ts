import { FetchHttpClient } from "effect/http";
import { Otlp, OtlpSerialization } from "effect/observability";
import { Layer } from "effect";

export const OpenTelemetryLive = Otlp.layerFromConfig().pipe(
  Layer.provide(OtlpSerialization.layerJson),
  Layer.provide(FetchHttpClient.layer),
);
