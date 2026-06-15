import { Cause, Effect } from "effect";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import type { Headers } from "effect/unstable/http/Headers";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { FrontendApi } from "@/api";
import { member, organization, session as authSession } from "@/db/auth-schema";
import { auth } from "@/services/auth/config";
import { db } from "@/services/database";
import { S3Service } from "@/services/s3";
import { s3AssetUrl } from "@/services/s3/asset-url";

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

const currentSession = (headers: Headers) =>
  Effect.tryPromise({
    try: () => auth.api.getSession({ headers }),
    catch: internalServerError,
  });

const requireSession = (headers: Headers) =>
  Effect.gen(function* () {
    const session = yield* currentSession(headers);
    if (!session) return yield* new HttpApiError.Unauthorized({});
    return session;
  });

const headerValue = (headers: Headers, name: string) => {
  const getter = (
    headers as unknown as { get?: (key: string) => string | null }
  ).get;
  if (getter) return getter.call(headers, name) ?? undefined;

  const record = headers as unknown as Record<string, string | undefined>;
  return record[name] ?? record[name.toLowerCase()];
};

const bearerToken = (value: string | undefined) => {
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
};

const requireServiceApiKey = (headers: Headers) =>
  Effect.gen(function* () {
    const key =
      bearerToken(headerValue(headers, "authorization")) ??
      headerValue(headers, "x-api-key");
    if (!key) return yield* new HttpApiError.Unauthorized({});

    const result = yield* Effect.tryPromise({
      try: () => auth.api.verifyApiKey({ body: { key, configId: "service" } }),
      catch: internalServerError,
    });

    if (!result.valid) return yield* new HttpApiError.Unauthorized({});
  });

const requireUserOrService = (headers: Headers, userId: string) =>
  requireServiceApiKey(headers).pipe(
    Effect.catchTag("Unauthorized", () =>
      Effect.gen(function* () {
        const session = yield* requireSession(headers);
        if (session.user.id !== userId) {
          return yield* new HttpApiError.Forbidden({});
        }
      }),
    ),
  );

const requireSessionOrService = (headers: Headers) =>
  requireServiceApiKey(headers).pipe(
    Effect.catchTag("Unauthorized", () =>
      requireSession(headers).pipe(Effect.asVoid),
    ),
  );

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "logo";

export const organizationsApiHandler = HttpApiBuilder.group(
  FrontendApi,
  "organizations",
  (handlers) =>
    handlers
      .handle("listUserOrganizations", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireUserOrService(request.headers, params.userId);

          const memberships = yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  id: organization.id,
                  name: organization.name,
                  slug: organization.slug,
                  logo: organization.logo,
                  metadata: organization.metadata,
                  createdAt: organization.createdAt,
                })
                .from(member)
                .innerJoin(
                  organization,
                  eq(member.organizationId, organization.id),
                )
                .where(eq(member.userId, params.userId)),
            catch: internalServerError,
          });

          return memberships;
        }),
      )
      .handle("getUserActiveOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireUserOrService(request.headers, params.userId);

          const [activeSession] = yield* Effect.tryPromise({
            try: () =>
              db
                .select({ id: authSession.activeOrganizationId })
                .from(authSession)
                .where(
                  and(
                    eq(authSession.userId, params.userId),
                    isNotNull(authSession.activeOrganizationId),
                    gt(authSession.expiresAt, new Date()),
                  ),
                )
                .orderBy(
                  desc(authSession.updatedAt),
                  desc(authSession.createdAt),
                )
                .limit(1),
            catch: internalServerError,
          });

          return { id: activeSession?.id ?? null };
        }),
      )
      .handle("presignOrganizationLogoUpload", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireSessionOrService(request.headers);

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

          return { uploadUrl, url: s3AssetUrl(key) };
        }),
      ),
);
