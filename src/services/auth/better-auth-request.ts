import { Context, Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { authForRequest, type Auth } from "@/services/auth/config";

type BetterAuthRequestShape = {
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

export class BetterAuthRequest extends Context.Service<
  BetterAuthRequest,
  BetterAuthRequestShape
>()("@/services/auth/BetterAuthRequest") {
  static readonly make = (
    request: HttpServerRequest.HttpServerRequest | Request,
  ) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const webRequest = yield* toWebRequest(request);
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
