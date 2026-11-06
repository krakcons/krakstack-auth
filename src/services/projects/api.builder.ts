import { Cause, Effect, Option, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { HttpServerRequest } from "effect/http";

import { AdminApi, FrontendApi } from "@/api";
import { Projects } from "@/services/projects";
import { uploadImageFromMultipart } from "@/services/s3/upload";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import {
  previewProjectAuthEmail,
  sendProjectAuthEmailTest,
} from "@/services/auth/email.server";
import { notificationLayer } from "@/services/auth/notification.server";

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
      .handle("updateProjectEmail", ({ params, payload }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .updateEmail({ id: params.id, settings: payload })
            .pipe(Effect.mapError(internalServerError));
          if (!project) return yield* new HttpApiError.NotFound({});
          return project;
        }),
      )
      .handle("previewProjectEmail", ({ params, payload }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .get({ id: params.id })
            .pipe(Effect.mapError(internalServerError));
          if (!project) return yield* new HttpApiError.NotFound({});
          const request = yield* HttpServerRequest.HttpServerRequest;
          const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
            Effect.mapError(internalServerError),
          );
          return yield* previewProjectAuthEmail({
            project,
            payload,
            origin: new URL(webRequest.url).origin,
          }).pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("testProjectEmail", ({ params, payload }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .get({ id: params.id })
            .pipe(Effect.mapError(internalServerError));
          if (!project) return yield* new HttpApiError.NotFound({});
          const request = yield* HttpServerRequest.HttpServerRequest;
          const client = yield* BetterAuthRequest.pipe(
            Effect.provide(BetterAuthRequest.make(request)),
            Effect.mapError(internalServerError),
          );
          const session = yield* Effect.tryPromise({
            try: () => client.api.getSession({ headers: client.headers }),
            catch: internalServerError,
          });
          if (!session) return yield* new HttpApiError.Unauthorized({});
          if (!session.user.emailVerified)
            return yield* new HttpApiError.Forbidden({});
          const email = yield* previewProjectAuthEmail({
            project,
            payload,
            origin: new URL(client.request.url).origin,
          }).pipe(Effect.mapError(internalServerError));
          yield* sendProjectAuthEmailTest({
            to: session.user.email,
            email,
            locale: payload.locale,
          }).pipe(
            Effect.provide(notificationLayer),
            Effect.mapError(internalServerError),
          );
        }),
      )
      .handle("projectStats", ({ params, query }) =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const project = yield* projects
            .get({ id: params.id })
            .pipe(Effect.mapError(internalServerError));
          if (!project) return yield* new HttpApiError.NotFound({});
          return yield* projects
            .stats({
              id: params.id,
              days: query.days ? Number(query.days) : 14,
            })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
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
