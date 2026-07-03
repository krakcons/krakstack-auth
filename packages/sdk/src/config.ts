import { Config, Context, Effect, Layer, Redacted } from "effect";

export const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

export const defaultBaseUrl = () => {
  const env = globalThis.process?.env;
  return normalizeBaseUrl(
    env?.KRAKSTACK_AUTH_URL ??
      env?.VITE_KRAKSTACK_AUTH_URL ??
      "http://localhost:3000",
  );
};

export type ClientConfig = {
  readonly baseUrl: string;
  readonly apiKey: Redacted.Redacted;
};

export class AuthClientConfig extends Context.Service<AuthClientConfig>()(
  "@krak-stack/auth/AuthClientConfig",
  {
    make: (options: Partial<ClientConfig> = {}) =>
      Effect.gen(function* () {
        const baseUrl =
          options.baseUrl ??
          process.env.KRAKSTACK_AUTH_URL ??
          (yield* Config.string("VITE_KRAKSTACK_AUTH_URL"));
        const apiKey =
          options.apiKey ??
          (yield* Config.redacted("KRAKSTACK_AUTH_SERVICE_API_KEY"));

        return {
          baseUrl: normalizeBaseUrl(baseUrl),
          apiKey,
        };
      }),
  },
) {
  static readonly layer = (options: Partial<ClientConfig> = {}) =>
    Layer.effect(this, this.make(options));
}
