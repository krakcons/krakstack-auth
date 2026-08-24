import { Cause, Effect, Option, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi, FrontendApi } from "@/api";
import { Projects } from "@/services/projects";
import { uploadImageFromMultipart } from "@/services/s3/upload";

const FailureWithCause = Schema.Struct({ cause: Schema.Unknown });

const internalServerError = (cause: unknown) => {
  const nestedCause = Option.map(
    Schema.decodeUnknownOption(FailureWithCause)(cause),
    (failure) => failure.cause,
  );
  console.error(
    "Failed to handle project request:",
    Cause.isCause(cause)
      ? Cause.pretty(cause)
      : Option.isSome(nestedCause) && Cause.isCause(nestedCause.value)
        ? Cause.pretty(nestedCause.value)
        : cause,
  );
  return new HttpApiError.InternalServerError({});
};

export const publicProjectsApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "publicProjects",
  (handlers) =>
    handlers.handle("getProjectPublicConfig", ({ query }) =>
      Effect.gen(function* () {
        const projects = yield* Projects;
        return yield* projects
          .getPublicConfig({
            projectId: query.projectId,
            clientId: query.clientId,
            host: query.host,
            rootHost: query.rootHost,
          })
          .pipe(Effect.mapError(internalServerError));
      }),
    ),
);

export const adminProjectsApiHandler = HttpApiBuilder.group(
  AdminApi,
  "projects",
  (handlers) =>
    handlers
      .handle("listProjects", () =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          return yield* projects
            .list()
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createProject", ({ payload }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .create({ payload })
            .pipe(Effect.mapError(internalServerError));

          if (!project) return yield* new HttpApiError.InternalServerError({});
          return project;
        }),
      )
      .handle("updateProject", ({ params, payload }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .update({ id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!project) return yield* new HttpApiError.NotFound({});
          return project;
        }),
      )
      .handle("deleteProject", ({ params }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .delete({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!project) return yield* new HttpApiError.NotFound({});
          return project;
        }),
      )
      .handle("uploadProjectLogo", ({ payload }) =>
        Effect.gen(function* () {
          const url = yield* uploadImageFromMultipart({
            payload,
            prefix: "logos/projects",
            fallbackFileName: "logo",
            badRequest: () => new HttpApiError.BadRequest({}),
            internalServerError,
          });

          return { url };
        }),
      ),
);
