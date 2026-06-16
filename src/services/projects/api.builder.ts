import { Cause, Effect } from "effect";
import type { Headers } from "effect/unstable/http/Headers";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi } from "@/api";
import { auth } from "@/services/auth/config";
import { Projects } from "@/services/projects";
import { S3Service } from "@/services/s3";
import { s3AssetUrl } from "@/services/s3/asset-url";

const userRole = (value: unknown) => {
  if (typeof value !== "object" || value === null || !("role" in value)) {
    return undefined;
  }
  return Reflect.get(value, "role");
};

const hasAdminRole = (role: unknown) =>
  typeof role === "string" &&
  role.split(",").some((item) => item.trim() === "admin");

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

const requireAdmin = (headers: Headers) =>
  Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
      catch: internalServerError,
    });

    if (!session) return yield* new HttpApiError.Unauthorized({});
    if (!hasAdminRole(userRole(session.user))) {
      return yield* new HttpApiError.Forbidden({});
    }
  });

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "logo";

export const adminProjectsApiHandler = HttpApiBuilder.group(
  AdminApi,
  "projects",
  (handlers) =>
    handlers
      .handle("getProjectPublicConfig", ({ query }) =>
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
      )
      .handle("listProjects", ({ request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);
          const projects = yield* Projects;
          return yield* projects
            .list()
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createProject", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);
          const projects = yield* Projects;
          const project = yield* projects
            .create({ payload })
            .pipe(Effect.mapError(internalServerError));

          if (!project) return yield* new HttpApiError.InternalServerError({});
          return project;
        }),
      )
      .handle("updateProject", ({ params, payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);
          const projects = yield* Projects;
          const project = yield* projects
            .update({ id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!project) return yield* new HttpApiError.NotFound({});
          return project;
        }),
      )
      .handle("deleteProject", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);
          const projects = yield* Projects;
          const project = yield* projects
            .delete({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!project) return yield* new HttpApiError.NotFound({});
          return project;
        }),
      )
      .handle("presignProjectLogoUpload", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

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
