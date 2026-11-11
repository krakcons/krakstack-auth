import { Effect, Layer } from "effect";
import {
  FetchHttpClient,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import type { OAuthResourceOptions } from "../oauth/schema.js";
import { verifyOAuthAccessToken } from "../oauth/verify.js";

const metadataPath = (resource: string): `/${string}` =>
  `/.well-known/oauth-protected-resource${new URL(resource).pathname.replace(/\/$/, "")}`;

const challenge = (
  options: OAuthResourceOptions,
  insufficientScope = false,
) => {
  const metadataUrl = new URL(metadataPath(options.resource), options.resource)
    .href;
  const scopes = insufficientScope
    ? options.requiredScopes
    : (options.challengeScopes ?? options.requiredScopes);
  return `Bearer resource_metadata="${metadataUrl}"${insufficientScope ? ', error="insufficient_scope"' : ""}, scope="${scopes.join(" ")}"`;
};

/** OAuth discovery and authentication for an existing MCP transport. */
export const McpAuth = {
  metadataPath,
  /** Forward public discovery through the consumer's existing auth proxy. */
  discoveryRequest: (request: Request, options: OAuthResourceOptions) => {
    const url = new URL(request.url);
    const issuer = new URL(options.issuer);
    if (
      url.pathname ===
      `/.well-known/oauth-authorization-server${issuer.pathname.replace(/\/$/, "")}`
    ) {
      url.pathname = `${issuer.pathname.replace(/\/$/, "")}/.well-known/oauth-authorization-server`;
      return new Request(url, request);
    }
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === metadataPath(options.resource)
    )
      return request;
    return undefined;
  },
  metadataLayer: (options: OAuthResourceOptions) => {
    const response = HttpServerResponse.jsonUnsafe(
      {
        resource: options.resource,
        authorization_servers: [options.issuer],
        scopes_supported: options.scopesSupported ?? options.requiredScopes,
        bearer_methods_supported: ["header"],
      },
      { headers: { "access-control-allow-origin": "*" } },
    );
    return Layer.mergeAll(
      HttpRouter.add(
        "GET",
        metadataPath(options.resource),
        Effect.succeed(response),
      ),
      HttpRouter.add(
        "GET",
        "/.well-known/oauth-protected-resource",
        Effect.succeed(response),
      ),
    );
  },
  middleware: (options: OAuthResourceOptions) =>
    HttpRouter.middleware((httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const authorization = request.headers.authorization;
        // Preserve explicitly supplied API keys for existing integrations. Their
        // normal API authorization remains authoritative for tool execution.
        if (authorization === undefined && request.headers["x-api-key"])
          return yield* httpEffect;
        const match = authorization?.match(/^Bearer ([^\s]+)$/i);
        if (!match?.[1])
          return HttpServerResponse.empty({
            status: 401,
            headers: { "www-authenticate": challenge(options) },
          });
        const result = yield* verifyOAuthAccessToken(match[1], options).pipe(
          Effect.provide(FetchHttpClient.layer),
          Effect.result,
        );
        if (result._tag === "Failure") {
          if (result.failure._tag === "ServiceUnavailable")
            return HttpServerResponse.empty({ status: 503 });
          const insufficientScope = result.failure._tag === "Forbidden";
          return HttpServerResponse.empty({
            status: insufficientScope ? 403 : 401,
            headers: {
              "www-authenticate": challenge(options, insufficientScope),
            },
          });
        }
        return yield* httpEffect;
      }),
    ),
};
