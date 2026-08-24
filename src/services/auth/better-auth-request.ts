import { Context, Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { authForRequest, type Auth } from "@/services/auth/config";

type BetterAuthRequestContext = {
  readonly auth: Auth;
  readonly request: Request;
  readonly headers: Headers;
  readonly api: Auth["api"];
  readonly handler: Auth["handler"];
};

const toWebRequest = (request: HttpServerRequest.HttpServerRequest | Request) =>
  request instanceof Request
    ? Effect.succeed(request)
    : HttpServerRequest.toWeb(request);

export const restoreProxyAuthOrigin = (request: Request) => {
  const host = request.headers.get("x-krakstack-forwarded-host");
  const protocol = request.headers.get("x-krakstack-forwarded-proto");
  if (!host || (protocol !== "http" && protocol !== "https")) return request;

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", protocol);
  headers.delete("x-krakstack-forwarded-host");
  headers.delete("x-krakstack-forwarded-proto");
  return new Request(request, { headers, method: request.method });
};

export class BetterAuthRequest extends Context.Service<
  BetterAuthRequest,
  BetterAuthRequestContext
>()("@/services/auth/BetterAuthRequest") {
  static readonly make = (
    request: HttpServerRequest.HttpServerRequest | Request,
  ) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const webRequest = restoreProxyAuthOrigin(yield* toWebRequest(request));
        const auth = yield* Effect.promise(() => authForRequest(webRequest));

        return {
          auth,
          request: webRequest,
          headers: webRequest.headers,
          api: auth.api,
          handler: auth.handler,
        };
      }),
    );
}
