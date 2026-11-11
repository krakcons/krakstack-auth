import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { AdminApi } from "@/api";
import { ProjectMcpService } from "./index";

export const projectMcpHandler = HttpApiBuilder.group(
  AdminApi,
  "projectMcp",
  (handlers) =>
    handlers
      .handle("getProjectMcp", ({ params }) =>
        Effect.gen(function* () {
          const service = yield* ProjectMcpService;
          return yield* service
            .get(params)
            .pipe(
              Effect.mapError(() => new HttpApiError.InternalServerError({})),
            );
        }),
      )
      .handle("configureProjectMcp", ({ params, payload }) =>
        Effect.gen(function* () {
          const service = yield* ProjectMcpService;
          const config = yield* service
            .configure({ ...params, settings: payload })
            .pipe(
              Effect.mapError((error) =>
                error._tag === "InvalidMcpEndpoint" ||
                error._tag === "SchemaError"
                  ? new HttpApiError.BadRequest({})
                  : new HttpApiError.InternalServerError({}),
              ),
            );
          if (!config) return yield* new HttpApiError.NotFound({});
          return config;
        }),
      ),
);
