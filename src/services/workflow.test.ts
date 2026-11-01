import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import { workflowRunnerSettings } from "./workflow";

const settings = (values: Record<string, string | undefined>) => workflowRunnerSettings.pipe(
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(values))),
);
describe("Workflow runner configuration", () => {
  it.effect("defaults to single without requiring a runner address", () => Effect.gen(function* () {
    expect(yield* settings({})).toEqual({ mode: "single" });
  }));
  it.effect("uses the pod IP and private HTTP port when opted in", () => Effect.gen(function* () {
    expect(yield* settings({ AUTH_WORKFLOW_RUNNER: "http", POD_IP: "10.0.0.8" })).toEqual({ mode: "http", host: "10.0.0.8", port: 34431 });
    expect(yield* settings({ AUTH_WORKFLOW_RUNNER: "http", AUTH_WORKFLOW_HOST: "auth-1.internal", POD_IP: "10.0.0.8", AUTH_WORKFLOW_PORT: "34432" })).toEqual({ mode: "http", host: "auth-1.internal", port: 34432 });
  }));
  it.effect("rejects missing addresses, invalid modes, and invalid ports", () => Effect.gen(function* () {
    for (const values of [
      { AUTH_WORKFLOW_RUNNER: "http" },
      { AUTH_WORKFLOW_RUNNER: "unknown" },
      { AUTH_WORKFLOW_RUNNER: "http", POD_IP: "10.0.0.8", AUTH_WORKFLOW_PORT: "0" },
    ]) {
      const error = yield* settings(values).pipe(Effect.flip);
      expect(error._tag).toBe("ConfigError");
    }
  }));
});
