import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const spanProcessors: SpanProcessor[] = [
  new BatchSpanProcessor(new OTLPTraceExporter()),
];

if (process.env.OTEL_TRACES_EXPORTER?.split(",").includes("console")) {
  spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
}

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    "service.name": process.env.OTEL_SERVICE_NAME ?? "krakstack-auth",
  }),
  spanProcessors,
});

provider.register();
