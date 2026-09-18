import { Context, Effect, Layer, Option, Redacted } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";
import {
  AuthProxyError,
  stripProxyOriginHeaders,
  readProxyOrigin,
} from "@krak-stack/auth/server";

import { authForRequest, type Auth } from "@/services/auth/config";
import { DB } from "@/services/database";
import {
  apiKeyAllowedOrigins,
  requestMatchesAllowedOrigins,
} from "@/services/auth/api-key-referrers";

type ProxyApiKeyVerifier = (input: {
  body: {
    key: string;
    configId: "service";
    permissions: Record<string, string[]>;
  };
}) => Promise<{ valid: boolean; key?: { metadata?: unknown } | null }>;

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

export const restoreProxyAuthOrigin = Effect.fn("Auth.restoreProxyOrigin")(
  function* (request: Request, verifyApiKey: ProxyApiKeyVerifier) {
    const origin = yield* readProxyOrigin(request);
    const headers = stripProxyOriginHeaders(request);
    if (Option.isSome(origin)) {
      const db = yield* DB;
      const domains = yield* db.query.domains.findMany({
        where: {
          hostname: origin.value.host,
          active: true,
        },
        limit: 2,
      });
      const projectId = domains[0]?.projectId;
      if (domains.length !== 1 || !projectId) {
        return yield* new AuthProxyError({ reason: "invalid" });
      }
      const proxyOrigin = `${origin.value.protocol}://${origin.value.host}`;
      const result = yield* Effect.tryPromise({
        try: () =>
          verifyApiKey({
            body: {
              key: Redacted.value(origin.value.apiKey),
              configId: "service",
              permissions: { [projectId]: ["auth:proxy"] },
            },
          }),
        catch: () => new AuthProxyError({ reason: "invalid" }),
      });
      if (
        !result.valid ||
        !result.key ||
        !requestMatchesAllowedOrigins(
          proxyOrigin,
          undefined,
          apiKeyAllowedOrigins(result.key.metadata),
        )
      )
        return yield* new AuthProxyError({ reason: "invalid" });
      headers.set("x-forwarded-host", origin.value.host);
      headers.set("x-forwarded-proto", origin.value.protocol);
    }
    return new Request(request, { headers, method: request.method });
  },
);

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
        const incoming = yield* toWebRequest(request);
        // Bootstrap key verification without trusting proxy headers or forwarding
        // the user's credentials to the API-key verification operation.
        const bootstrap = new Request(incoming.url, {
          headers: stripProxyOriginHeaders(incoming),
        });
        const webRequest = yield* restoreProxyAuthOrigin(
          incoming,
          async (input) => {
            const verifier = await authForRequest(bootstrap);
            return verifier.api.verifyApiKey(input);
          },
        ).pipe(
          Effect.provide(DB.layer),
          Effect.mapError((error) =>
            error instanceof AuthProxyError && error.reason === "invalid"
              ? new HttpApiError.Unauthorized({})
              : new HttpApiError.InternalServerError({}),
          ),
        );
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
