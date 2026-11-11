import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Etag, HttpRouter } from "effect/http";
import { HttpApi, HttpApiBuilder, HttpApiError } from "effect/http-api";

import { AdminApi } from "@/api";
import { AdminAuthMiddleware } from "@/services/auth/middleware";
import { ProjectMcpService } from "./index";
import { projectMcpHandler } from "./api.builder";

describe("project MCP administration", () => {
  for (const [status, denied] of [
    [401, new HttpApiError.Unauthorized({})],
    [403, new HttpApiError.Forbidden({})],
  ] as const) {
    it.effect(
      `enforces the admin middleware before reading or saving settings (${status})`,
      () =>
        Effect.gen(function* () {
          const service = Layer.succeed(ProjectMcpService, {
            get: () => Effect.die("unauthorized read"),
            configure: () => Effect.die("unauthorized write"),
          });
          const web = yield* Effect.acquireRelease(
            Effect.sync(() =>
              HttpRouter.toWebHandler(
                HttpApiBuilder.layer(
                  HttpApi.make("AdminApi").add(AdminApi.groups.projectMcp),
                ).pipe(
                  Layer.provide(projectMcpHandler),
                  Layer.provide(
                    Layer.succeed(AdminAuthMiddleware, () =>
                      Effect.fail(denied),
                    ),
                  ),
                  HttpRouter.provideRequest(service),
                  Layer.provide(BunHttpPlatform.layer),
                  Layer.provide(Etag.layer),
                  Layer.provide(BunServices.layer),
                ),
                { disableLogger: true },
              ),
            ),
            (web) => Effect.promise(web.dispose),
          );
          for (const method of ["GET", "PUT"]) {
            const request = new Request(
              "http://localhost/api/auth/admin/projects/project/mcp",
              method === "GET"
                ? { method }
                : {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      url: "https://app.example.com/api/mcp",
                      enabled: true,
                      dynamicClientRegistration: true,
                      scopes: ["mcp:read"],
                    }),
                  },
            );
            expect(
              (yield* Effect.promise(() => web.handler(request))).status,
            ).toBe(status);
          }
        }),
    );
  }
});
