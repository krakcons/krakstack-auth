import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { AdminApi } from "@/api";
import { ProjectWebhooks } from "./index";

export const projectWebhooksHandler = HttpApiBuilder.group(
  AdminApi,
  "projectWebhooks",
  (handlers) =>
    handlers
      .handle("listProjectWebhooks", () =>
        Effect.gen(function* () {
          const service = yield* ProjectWebhooks;
          return yield* service
            .list()
            .pipe(
              Effect.mapError(() => new HttpApiError.InternalServerError({})),
            );
        }),
      )
      .handle("listProjectWebhookDeliveries", ({ params, query }) =>
        Effect.gen(function* () {
          const service = yield* ProjectWebhooks;
          const result = yield* service
            .deliveries({ ...params, query })
            .pipe(
              Effect.mapError(() => new HttpApiError.InternalServerError({})),
            );
          if (!result) return yield* new HttpApiError.NotFound({});
          return result;
        }),
      )
      .handle("getProjectWebhook", ({ params }) =>
        Effect.gen(function* () {
          const service = yield* ProjectWebhooks;
          return yield* service
            .endpoint(params)
            .pipe(
              Effect.mapError(() => new HttpApiError.InternalServerError({})),
            );
        }),
      )
      .handle("configureProjectWebhook", ({ params, payload }) =>
        Effect.gen(function* () {
          const service = yield* ProjectWebhooks;
          const endpoint = yield* service
            .configure({ ...params, ...payload })
            .pipe(
              Effect.catchTag("SchemaError", () =>
                Effect.fail(new HttpApiError.BadRequest({})),
              ),
              Effect.mapError((error) =>
                error instanceof HttpApiError.BadRequest
                  ? error
                  : new HttpApiError.InternalServerError({}),
              ),
            );
          if (!endpoint) return yield* new HttpApiError.NotFound({});
          return endpoint;
        }),
      ),
);
