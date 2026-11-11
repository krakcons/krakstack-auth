import { verifyJwsAccessToken } from "@better-auth/core/oauth2";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { HttpApiError } from "effect/http-api";

import { OAuthAccessTokenClaims, type OAuthResourceOptions } from "./schema.js";

const PublicJwkSet = Schema.Struct({
  keys: Schema.Array(
    Schema.Struct({
      kty: Schema.String,
      kid: Schema.optional(Schema.String),
      alg: Schema.optional(Schema.String),
      use: Schema.optional(Schema.String),
      crv: Schema.optional(Schema.String),
      x: Schema.optional(Schema.String),
      y: Schema.optional(Schema.String),
      n: Schema.optional(Schema.String),
      e: Schema.optional(Schema.String),
    }),
  ),
}).annotate({ identifier: "OAuthPublicJwkSet" });

// Stable per-URL identity enables Better Auth's bounded JWKS cache and kid-miss
// refresh. The URL is trusted application configuration, never token input.
const jwksCacheKeys = new Map<string, object>();

class OAuthJwksUnavailable extends Schema.TaggedError<
  OAuthJwksUnavailable,
  { readonly brand: unique symbol }
>()("OAuthJwksUnavailable", {}) {}

export const verifyOAuthAccessToken = Effect.fn("Auth.verifyOAuthAccessToken")(
  function* (token: string, options: OAuthResourceOptions) {
    const http = yield* HttpClient.HttpClient;
    const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
    let cacheKey = jwksCacheKeys.get(options.jwksUrl);
    if (!cacheKey) {
      cacheKey = {};
      jwksCacheKeys.set(options.jwksUrl, cacheKey);
    }
    const payload = yield* Effect.tryPromise({
      try: () =>
        verifyJwsAccessToken(token, {
          jwksCacheKey: cacheKey,
          jwksFetch: async () => {
            const result = await runPromise(
              HttpClient.filterStatusOk(http)
                .get(options.jwksUrl)
                .pipe(
                  Effect.flatMap(
                    HttpClientResponse.schemaBodyJson(PublicJwkSet),
                  ),
                  Effect.map((jwks) => ({ keys: Array.from(jwks.keys) })),
                  Effect.result,
                ),
            );
            if (result._tag === "Failure") throw new OAuthJwksUnavailable({});
            return result.success;
          },
          verifyOptions: {
            issuer: options.issuer,
            audience: options.resource,
            typ: "at+jwt",
            requiredClaims: [
              "sub",
              "azp",
              "exp",
              "iat",
              "scope",
              "organization_id",
            ],
          },
        }),
      catch: (error) =>
        error instanceof OAuthJwksUnavailable
          ? new HttpApiError.ServiceUnavailable({})
          : new HttpApiError.Unauthorized({}),
    });
    const claims = yield* Schema.decodeUnknownEffect(OAuthAccessTokenClaims)(
      payload,
    ).pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})));
    const scopes = new Set(claims.scope.split(/\s+/).filter(Boolean));
    if (!options.requiredScopes.every((scope) => scopes.has(scope))) {
      return yield* new HttpApiError.Forbidden({});
    }
    return claims;
  },
);
