import { Cause, Effect, Layer, Option } from "effect";
import { Headers } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { auth } from "@/services/auth/config";

import { BackendAuth } from ".";
import { BackendAuthApi } from "./api.group";

const internalServerError = (error: unknown) => {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? Reflect.get(error, "cause")
      : null;
  console.error(
    "Failed to handle backend auth request:",
    Cause.isCause(error)
      ? Cause.pretty(error)
      : Cause.isCause(cause)
        ? Cause.pretty(cause)
        : error,
  );
  return new HttpApiError.InternalServerError({});
};

const bearerToken = (value: string | undefined) => {
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
};

const serviceApiKey = (headers: Headers.Headers) =>
  bearerToken(Option.getOrUndefined(Headers.get(headers, "authorization"))) ??
  Option.getOrUndefined(Headers.get(headers, "x-api-key"));

const requireServiceApiKey = (headers: Headers.Headers) =>
  Effect.gen(function* () {
    const key = serviceApiKey(headers);
    if (!key) return yield* new HttpApiError.Unauthorized({});

    const result = yield* Effect.tryPromise({
      try: () => auth.api.verifyApiKey({ body: { key, configId: "service" } }),
      catch: internalServerError,
    });

    if (!result.valid) return yield* new HttpApiError.Unauthorized({});
  });

const parseIds = (ids: string) =>
  ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const organizationQuery = (query: {
  readonly ids?: string | undefined;
  readonly userId?: string | undefined;
}) => {
  const ids = query.ids ? parseIds(query.ids) : [];
  const userId = query.userId?.trim() || undefined;

  if ((ids.length > 0 && userId) || (ids.length === 0 && !userId)) {
    return undefined;
  }

  return { ids, userId };
};

const backendAuthUsersApiHandler = HttpApiBuilder.group(
  BackendAuthApi,
  "backendUsers",
  (handlers) =>
    handlers
      .handle("listUsersByIds", ({ query, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          return yield* backendAuth
            .listUsersByIds({ ids: parseIds(query.ids) })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("getUser", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          const user = yield* backendAuth
            .getUser({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!user) return yield* new HttpApiError.NotFound({});

          return user;
        }),
      )
      .handle("getUserActiveOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          return yield* backendAuth
            .getUserActiveOrganization({ userId: params.userId })
            .pipe(Effect.mapError(internalServerError));
        }),
      ),
);

const backendAuthOrganizationsApiHandler = HttpApiBuilder.group(
  BackendAuthApi,
  "backendOrganizations",
  (handlers) =>
    handlers
      .handle("listOrganizations", ({ query, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const parsedQuery = organizationQuery(query);
          if (!parsedQuery) return yield* new HttpApiError.BadRequest({});

          const backendAuth = yield* BackendAuth;
          if (parsedQuery.userId) {
            return yield* backendAuth
              .listOrganizationsByUserId({ userId: parsedQuery.userId })
              .pipe(Effect.mapError(internalServerError));
          }

          return yield* backendAuth
            .listOrganizationsByIds({ ids: parsedQuery.ids })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("getOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          const organization = yield* backendAuth
            .getOrganization({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});

          return organization;
        }),
      )
      .handle("getActiveMember", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          const member = yield* backendAuth
            .getActiveMember({
              organizationId: params.organizationId,
              userId: params.userId,
            })
            .pipe(Effect.mapError(internalServerError));

          if (!member) return yield* new HttpApiError.NotFound({});

          return member;
        }),
      )
      .handle("listOrganizationMembers", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireServiceApiKey(request.headers);

          const backendAuth = yield* BackendAuth;
          return yield* backendAuth
            .listOrganizationMembers({
              organizationId: params.organizationId,
            })
            .pipe(Effect.mapError(internalServerError));
        }),
      ),
);

export const backendAuthApiHandler = backendAuthUsersApiHandler.pipe(
  Layer.merge(backendAuthOrganizationsApiHandler),
);
