import { Context, Effect, FileSystem, Layer, Path } from "effect";
import { CredentialsFromEnv } from "@distilled.cloud/cloudflare";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import {
  Etag,
  HttpEffect,
  HttpMiddleware,
  HttpPlatform,
  HttpRouter,
  HttpServerResponse,
} from "effect/unstable/http";
import { HttpApiBuilder, OpenApi } from "effect/unstable/httpapi";

import { AdminApi, AuthDocsApi, FrontendApi } from "@/api";
import { corsMiddleware } from "@/lib/cors";
import { adminApiHandler } from "@/services/admin/api.builder";
import { authApiHandler } from "@/services/auth/api.builder";
import { authForRequest } from "@/services/auth/config";
import { BackendAuth } from "@/services/backend-auth";
import { backendAuthApiHandler } from "@/services/backend-auth/api.builder";
import { BackendAuthApi } from "@/services/backend-auth/api.group";
import { Domains } from "@/services/domains";
import { OAuthClients } from "@/services/oauth";
import { adminOAuthClientsApiHandler } from "@/services/oauth/api.builder";
import { OpenTelemetry } from "@/services/opentelemetry";
import { Organizations } from "@/services/organizations";
import { organizationsApiHandler } from "@/services/organizations/api.builder";
import { Projects } from "@/services/projects";
import { adminProjectsApiHandler } from "@/services/projects/api.builder";
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

export const authWebHandler = async (request: Request) =>
  (await authForRequest(request)).handler(request);

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

const logoContentType = (path: string) => {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

const logoAssetHandlerEffect = HttpEffect.fromWebHandler(async (request) => {
  const prefix = "/api/assets/";
  const path = decodeURIComponent(
    new URL(request.url).pathname.slice(prefix.length),
  );

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

const authRoutesLayer = HttpRouter.add("*", "/api/auth/*", authHandlerEffect);
const logoAssetRoutesLayer = HttpRouter.add(
  "GET",
  "/api/assets/*",
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
      title: "Admin API",
      slug: "admin-api",
      url: "/api/admin-openapi.json",
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
  HttpApiBuilder.layer(AdminApi, {
    openapiPath: "/api/admin-openapi.json",
  }).pipe(
    Layer.provide(adminApiHandler),
    Layer.provide(adminOAuthClientsApiHandler),
    Layer.provide(adminProjectsApiHandler),
  ),
  HttpApiBuilder.layer(FrontendApi).pipe(
    Layer.provide(authApiHandler),
    Layer.provide(organizationsApiHandler),
  ),
  HttpApiBuilder.layer(BackendAuthApi, {
    openapiPath: "/api/backend-openapi.json",
  }).pipe(Layer.provide(backendAuthApiHandler)),
  docsLayer,
  authDocsOpenApiLayer,
  logoAssetRoutesLayer,
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
);

const apiWebHandler = HttpEffect.toWebHandlerLayerWith(appServicesLayer, {
  middleware: HttpMiddleware.logger,
  toHandler: (context) =>
    HttpRouter.toHttpEffect(apiLayer).pipe(
      Effect.provide(context),
      Effect.scoped,
    ),
});

export const apiHandler = corsMiddleware((request) =>
  apiWebHandler.handler(request, Context.empty()),
);
export const disposeApiHandler = apiWebHandler.dispose;
