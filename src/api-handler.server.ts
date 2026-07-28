import { Context, Effect, FileSystem, Layer, Path, Redacted } from "effect";
import { CredentialsFromEnv } from "@distilled.cloud/cloudflare";
import { AuthMiddleware, AuthService } from "@krak-stack/auth/server";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import {
  Etag,
  HttpEffect,
  HttpMiddleware,
  HttpPlatform,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import {
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { AdminApi, FrontendApi } from "@/api";
import { LocaleMiddlewareLive } from "@/lib/localization";
import { AuthDocsApi } from "@/api.docs";
import { corsMiddleware } from "@/lib/cors";
import { adminApiHandler } from "@/services/admin/api.builder";
import { authApiHandler } from "@/services/auth/api.builder";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import {
  adminAuthMiddlewareLayer,
  serviceApiKeyMiddlewareLayer,
} from "@/services/auth/middleware.server";
import { BackendAuth } from "@/services/backend-auth";
import { backendAuthApiHandler } from "@/services/backend-auth/api.builder";
import { BackendAuthApi } from "@/services/backend-auth/api.group";
import { DB } from "@/services/database";
import { Domains } from "@/services/domains";
import { OAuthClients } from "@/services/oauth";
import {
  adminOAuthClientsApiHandler,
  publicOAuthClientsApiHandler,
} from "@/services/oauth/api.builder";
import { OpenTelemetry } from "@/services/opentelemetry";
import { Organizations } from "@/services/organizations";
import { Projects } from "@/services/projects";
import {
  adminProjectsApiHandler,
  publicProjectsApiHandler,
} from "@/services/projects/api.builder";
import { S3Service } from "@/services/s3";

const fileSystemLayer = FileSystem.layerNoop({});
const httpPlatformLayer = HttpPlatform.layer.pipe(
  Layer.provide(fileSystemLayer),
);

const platformLayer = Layer.mergeAll(
  Path.layer,
  fileSystemLayer,
  Etag.layerWeak,
  httpPlatformLayer,
);

const CloudflareLive = Layer.mergeAll(
  FetchHttpClient.layer,
  CredentialsFromEnv,
);

const organizationImpersonationAllowedAuthPaths = [
  { method: "GET", path: "/api/auth/get-session" },
  { method: "GET", path: "/api/auth/project-config" },
  { method: "POST", path: "/api/auth/verify-api-key" },
  { method: "POST", path: "/api/auth/admin/stop-impersonating" },
  { method: "GET", path: "/api/auth/ok" },
  { method: "POST", path: "/api/auth/sign-out" },
] as const;
const authMiddlewareOptions = {
  endpoint: HttpApiEndpoint.get("betterAuth", "/api/auth/*", {
    error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
  }),
  group: HttpApiGroup.make("betterAuth"),
  credential: Redacted.make(""),
};
const localAuthServiceLayer = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const betterAuth = yield* BetterAuthRequest.pipe(
      Effect.provide(BetterAuthRequest.make(request)),
    );

    return {
      getSession: () =>
        Effect.tryPromise({
          try: () => betterAuth.api.getSession({ headers: betterAuth.headers }),
          catch: () => new HttpApiError.Unauthorized({}),
        }),
      requireSession: () => Effect.fail(new HttpApiError.Unauthorized({})),
      requireUser: () => Effect.fail(new HttpApiError.Unauthorized({})),
      requireOrganization: () => Effect.fail(new HttpApiError.Unauthorized({})),
      requireUserOrganization: () =>
        Effect.fail(new HttpApiError.Unauthorized({})),
    } as never;
  }),
);
const authMiddlewareLayer = AuthMiddleware.layer({
  allowedOrganizationImpersonationRoutes:
    organizationImpersonationAllowedAuthPaths,
  authLayer: localAuthServiceLayer,
});

export const authWebHandler = async (request: Request) => {
  const authRequest = await Effect.runPromise(
    BetterAuthRequest.pipe(Effect.provide(BetterAuthRequest.make(request))),
  );
  return await authRequest.handler(request);
};

const authHandlerEffect = HttpEffect.fromWebHandler((request) =>
  Promise.resolve(authWebHandler(request)),
).pipe(
  Effect.catch((error) =>
    Effect.sync(() => {
      console.error("[HTTP] auth handler failed:", error);
      return HttpServerResponse.jsonUnsafe(
        { error: "Internal server error" },
        { status: 500 },
      );
    }),
  ),
);
const guardedAuthHandlerEffect = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const middleware = yield* AuthMiddleware;
  return yield* middleware.apiKey(
    authHandlerEffect.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    ),
    authMiddlewareOptions,
  );
}).pipe(Effect.provide(authMiddlewareLayer));

const logoContentType = (path: string) => {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

const logoAssetHandlerEffect = HttpEffect.fromWebHandler(async (request) => {
  const pathname = new URL(request.url).pathname;
  const prefix = pathname.startsWith("/api/auth/assets/")
    ? "/api/auth/assets/"
    : "/api/assets/";
  const path = decodeURIComponent(pathname.slice(prefix.length));

  if (!path.startsWith("logos/") || path.includes("..")) {
    return Response.json({}, { status: 404 });
  }

  const stream = await Effect.runPromise(
    Effect.gen(function* () {
      const s3 = yield* S3Service;
      const file = yield* s3.file(path);
      return file.stream();
    }).pipe(Effect.provide(S3Service.layer)),
  );

  return new Response(stream, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": logoContentType(path),
    },
  });
});

const authRoutesLayer = HttpRouter.add(
  "*",
  "/api/auth/*",
  guardedAuthHandlerEffect,
);
const logoAssetRoutesLayer = HttpRouter.add(
  "GET",
  "/api/assets/*",
  logoAssetHandlerEffect,
);
const authLogoAssetRoutesLayer = HttpRouter.add(
  "GET",
  "/api/auth/assets/*",
  logoAssetHandlerEffect,
);

const scalarDocsConfig = {
  theme: "default",
  sources: [
    {
      title: "Auth API",
      slug: "auth-api",
      url: "/api/auth-openapi.json",
    },
    {
      title: "Better Auth",
      slug: "better-auth",
      url: "/api/auth/open-api/generate-schema",
    },
  ],
};

const docsHtml = `<!doctype html>
<html>
  <head>
    <title>KrakStack Auth API Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', ${JSON.stringify(scalarDocsConfig)})
    </script>
  </body>
</html>`;

const docsLayer = HttpRouter.add(
  "GET",
  "/api/docs",
  Effect.succeed(HttpServerResponse.html(docsHtml)),
);

const authDocsOpenApiLayer = HttpRouter.add(
  "GET",
  "/api/auth-openapi.json",
  Effect.succeed(HttpServerResponse.jsonUnsafe(OpenApi.fromApi(AuthDocsApi))),
);

const apiLayer = Layer.mergeAll(
  HttpApiBuilder.layer(AdminApi).pipe(
    Layer.provide(adminApiHandler),
    Layer.provide(adminOAuthClientsApiHandler),
    Layer.provide(adminProjectsApiHandler),
    Layer.provide(adminAuthMiddlewareLayer),
  ),
  HttpApiBuilder.layer(FrontendApi).pipe(
    Layer.provide(authApiHandler),
    Layer.provide(publicOAuthClientsApiHandler),
    Layer.provide(publicProjectsApiHandler),
    Layer.provide(LocaleMiddlewareLive),
  ),
  HttpApiBuilder.layer(BackendAuthApi, {
    openapiPath: "/api/backend-openapi.json",
  }).pipe(
    Layer.provide(backendAuthApiHandler),
    Layer.provide(serviceApiKeyMiddlewareLayer),
  ),
  docsLayer,
  authDocsOpenApiLayer,
  logoAssetRoutesLayer,
  authLogoAssetRoutesLayer,
  authRoutesLayer,
).pipe(Layer.provide(platformLayer));

const appServicesLayer = Layer.mergeAll(
  OpenTelemetry.layer,
  OAuthClients.layer,
  BackendAuth.layer,
  Domains.layer,
  Organizations.layer,
  Projects.layer,
  S3Service.layer,
  CloudflareLive,
).pipe(Layer.provideMerge(DB.layer));

const apiWebHandler = HttpEffect.toWebHandlerLayerWith(appServicesLayer, {
  middleware: HttpMiddleware.logger,
  toHandler: (context) =>
    HttpRouter.toHttpEffect(apiLayer).pipe(
      Effect.provide(context),
      Effect.scoped,
    ),
});
const emptyHandlerContext = Context.empty() as Context.Context<unknown>;

export const apiHandler = corsMiddleware((request) =>
  apiWebHandler.handler(request, emptyHandlerContext),
);
export const disposeApiHandler = apiWebHandler.dispose;
