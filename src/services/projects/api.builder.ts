import { Cause, Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi, FrontendApi } from "@/api";
import { Projects } from "@/services/projects";
import { S3Service } from "@/services/s3";
import { s3AssetUrl } from "@/services/s3/asset-url";

const internalServerError = (error: unknown) => {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? Reflect.get(error, "cause")
      : null;
  console.error(
    "Failed to handle project request:",
    Cause.isCause(error)
      ? Cause.pretty(error)
      : Cause.isCause(cause)
        ? Cause.pretty(cause)
        : error,
  );
  return new HttpApiError.InternalServerError({});
};

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "logo";

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
      .handle("presignProjectLogoUpload", ({ payload }) =>
        Effect.gen(function* () {
          if (!payload.contentType.startsWith("image/")) {
            return yield* new HttpApiError.BadRequest({});
          }

          const s3 = yield* S3Service;
          const key = `logos/projects/${crypto.randomUUID()}-${safeFileName(payload.fileName)}`;
          const uploadUrl = yield* s3
            .presign(key, {
              expiresIn: 300,
              method: "PUT",
              type: payload.contentType,
            })
            .pipe(Effect.mapError(internalServerError));

          return { uploadUrl, url: s3AssetUrl(key) };
        }),
      ),
);
