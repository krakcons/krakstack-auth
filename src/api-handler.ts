import { Effect, FileSystem, Layer, Path } from "effect";
import {
  Etag,
  HttpEffect,
  HttpPlatform,
  HttpRouter,
  HttpServerResponse,
} from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AdminApi, FrontendApi } from "@/api";
import { isAuthorizedAuthHost } from "@/lib/auth-domains";
import { corsMiddleware } from "@/lib/cors";
import { adminApiHandler } from "@/services/admin/api.builder";
import { authApiHandler } from "@/services/auth/api.builder";
import { auth } from "@/services/auth/config";
import { BackendAuth } from "@/services/backend-auth";
import { backendAuthApiHandler } from "@/services/backend-auth/api.builder";
import { BackendAuthApi } from "@/services/backend-auth/api.group";
import { OAuthClients } from "@/services/oauth";
import { adminOAuthClientsApiHandler } from "@/services/oauth/api.builder";
import { Organizations } from "@/services/organizations";
import { organizationsApiHandler } from "@/services/organizations/api.builder";
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

export const authWebHandler = async (request: Request) => {
  if (!(await isAuthorizedAuthHost(request))) {
    return Response.json({ error: "Unknown auth host" }, { status: 404 });
  }

  return auth.handler(request);
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
      title: "Admin API",
      slug: "admin-api",
      url: "/api/admin-openapi.json",
    },
    {
      title: "Frontend API",
      slug: "frontend-api",
      url: "/api/frontend-openapi.json",
    },
    {
      title: "Backend API",
      slug: "backend-auth-api",
      url: "/api/backend-openapi.json",
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

const apiLayer = Layer.mergeAll(
  HttpApiBuilder.layer(AdminApi, {
    openapiPath: "/api/admin-openapi.json",
  }).pipe(
    Layer.provide(adminApiHandler),
    Layer.provide(adminOAuthClientsApiHandler),
  ),
  HttpApiBuilder.layer(FrontendApi, {
    openapiPath: "/api/frontend-openapi.json",
  }).pipe(
    Layer.provide(authApiHandler),
    Layer.provide(organizationsApiHandler),
  ),
  HttpApiBuilder.layer(BackendAuthApi, {
    openapiPath: "/api/backend-openapi.json",
  }).pipe(Layer.provide(backendAuthApiHandler)),
  docsLayer,
  logoAssetRoutesLayer,
  authRoutesLayer,
).pipe(Layer.provide(platformLayer));

const appServicesLayer = Layer.mergeAll(
  OAuthClients.layer,
  BackendAuth.layer,
  Organizations.layer,
  S3Service.layer,
);

const apiWebHandler = HttpEffect.toWebHandlerLayerWith(appServicesLayer, {
  toHandler: (context) =>
    HttpRouter.toHttpEffect(apiLayer).pipe(
      Effect.provide(context),
      Effect.scoped,
    ),
});

export const apiHandler = corsMiddleware((request) =>
  apiWebHandler.handler(request),
);
export const disposeApiHandler = apiWebHandler.dispose;
