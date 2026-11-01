import { Config, Effect, Layer, Option, Schema } from "effect";
import { BunClusterHttp, BunCrypto } from "@effect/platform-bun";
import { ClusterWorkflowEngine, RunnerAddress, SingleRunner } from "effect/cluster";
import { sqlLayer } from "./database";

const WorkflowPort = Schema.NumberFromString.check(
  Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 65535 }),
).annotate({ identifier: "AuthWorkflowPort" });

export const workflowRunnerSettings = Effect.gen(function* () {
  const mode = yield* Config.schema(Schema.Literals(["single", "http"]), "AUTH_WORKFLOW_RUNNER").pipe(Config.withDefault("single"));
  if (mode === "single") return { mode };
  const host = yield* Config.NonEmptyString("AUTH_WORKFLOW_HOST").pipe(Config.orElse(() => Config.NonEmptyString("POD_IP")));
  const port = yield* Config.schema(WorkflowPort, "AUTH_WORKFLOW_PORT").pipe(Config.withDefault(34431));
  return { mode, host, port };
});

export const runnersLayer = Layer.unwrap(Effect.gen(function* () {
  const settings = yield* workflowRunnerSettings;
  if (settings.mode === "single") return SingleRunner.layer({ runnerStorage: "memory" });
  return BunClusterHttp.layer({
    transport: "http",
    storage: "sql",
    shardingConfig: {
      runnerAddress: Option.some(RunnerAddress.make(settings.host, settings.port)),
      runnerListenAddress: Option.some(RunnerAddress.make("0.0.0.0", settings.port)),
    },
  });
}));

// Both topologies retain SQL-backed messages/workflow state. Never overlap
// Single and HTTP executors against the same storage, including on rollback.
export const workflowEngineLayer = ClusterWorkflowEngine.layer.pipe(
  Layer.provide(runnersLayer),
  Layer.provide(BunCrypto.layer),
  Layer.provide(sqlLayer),
);
