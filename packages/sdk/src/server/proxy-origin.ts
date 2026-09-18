import { Data, Effect, Option, Redacted, Schema } from "effect";

import { AuthProxyOrigin } from "./schema.js";

export class AuthProxyError extends Data.TaggedError("AuthProxyError")<{
  readonly reason: "invalid" | "configuration" | "upstream";
}> {}

export const authProxyKeyHeader = "x-krakstack-proxy-key";

export const stripProxyOriginHeaders = (request: Request) => {
  const headers = new Headers(request.headers);
  for (const name of Array.from(headers.keys())) {
    if (
      name === "forwarded" ||
      name.startsWith("x-forwarded-") ||
      name.startsWith("x-krakstack-")
    )
      headers.delete(name);
  }
  return headers;
};

export const proxyOriginHeaders = Effect.fn("AuthProxy.originHeaders")(
  function* (request: Request, apiKey?: Redacted.Redacted<string>) {
    const url = new URL(request.url);
    const origin = yield* Schema.decodeUnknownEffect(AuthProxyOrigin)({
      host: url.host,
      protocol: url.protocol.slice(0, -1),
      apiKey: apiKey
        ? Redacted.value(apiKey)
        : process.env.KRAKSTACK_AUTH_SERVICE_API_KEY,
    }).pipe(
      Effect.mapError(() => new AuthProxyError({ reason: "configuration" })),
    );
    return new Headers({
      "x-krakstack-forwarded-host": origin.host,
      "x-krakstack-forwarded-proto": origin.protocol,
      [authProxyKeyHeader]: Redacted.value(origin.apiKey),
    });
  },
);

export const readProxyOrigin = Effect.fn("AuthProxy.readOrigin")(function* (
  request: Request,
) {
  if (
    !Array.from(request.headers.keys()).some((name) =>
      name.startsWith("x-krakstack-"),
    )
  ) {
    return Option.none<typeof AuthProxyOrigin.Type>();
  }
  const origin = yield* Schema.decodeUnknownEffect(AuthProxyOrigin)({
    host: request.headers.get("x-krakstack-forwarded-host"),
    protocol: request.headers.get("x-krakstack-forwarded-proto"),
    apiKey: request.headers.get(authProxyKeyHeader),
  }).pipe(Effect.mapError(() => new AuthProxyError({ reason: "invalid" })));
  return Option.some(origin);
});
