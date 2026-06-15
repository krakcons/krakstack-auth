import { Config, Effect, Redacted } from "effect";

export const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

export const defaultBaseUrl = () => {
  const env = globalThis.process?.env;
  return normalizeBaseUrl(
    env?.VITE_KRAKSTACK_AUTH_URL ?? "http://localhost:3000",
  );
};

export const readClientConfig = Effect.gen(function* () {
  const baseUrl = yield* Config.string("VITE_KRAKSTACK_AUTH_URL");
  const apiKey = yield* Config.redacted("KRAKSTACK_AUTH_SERVICE_API_KEY");

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
  };
});

export type ClientConfig = {
  readonly baseUrl: string;
  readonly apiKey: Redacted.Redacted;
};
