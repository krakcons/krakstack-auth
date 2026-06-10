import { Cause, Effect } from "effect";
import type { Headers } from "effect/unstable/http/Headers";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { Api } from "@/api";
import { auth } from "@/services/auth/config";
import { S3Service } from "@/services/s3";

import { Organizations } from ".";

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
    "Failed to handle organization request:",
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

const assetUrl = (key: string) =>
  `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;

export const organizationsApiHandler = HttpApiBuilder.group(
  Api,
  "organizations",
  (handlers) =>
    handlers
      .handle("listOrganizations", ({ request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          return yield* service
            .list({ headers: request.headers })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createOrganization", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          return yield* service
            .create({ headers: request.headers, payload })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("updateOrganization", ({ params, payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          const organization = yield* service
            .update({ headers: request.headers, id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("deleteOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          const organization = yield* service
            .delete({ headers: request.headers, id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("presignOrganizationLogoUpload", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          if (!payload.contentType.startsWith("image/")) {
            return yield* new HttpApiError.BadRequest({});
          }

          const s3 = yield* S3Service;
          const key = `logos/organizations/${crypto.randomUUID()}-${safeFileName(payload.fileName)}`;
          const uploadUrl = yield* s3
            .presign(key, {
              expiresIn: 300,
              method: "PUT",
              type: payload.contentType,
            })
            .pipe(Effect.mapError(internalServerError));

          return { uploadUrl, url: assetUrl(key) };
        }),
      ),
);
