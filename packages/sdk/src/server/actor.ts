import { Effect, Layer, Option, References, Schema } from "effect";
import { HttpApiError, HttpApiMiddleware } from "effect/http-api";

import {
  ApiKeyPermissionGrant,
  CurrentActor,
  type ProjectAccessDefinition,
} from "../access.js";
import { parseRoleList } from "../roles.js";
import { AuthService } from "../service.js";

const activeMemberRoles = ({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const role = yield* auth
      .getActiveMemberRole({ organizationId, userId })
      .pipe(Effect.mapError(() => new HttpApiError.Forbidden({})));
    return parseRoleList(role);
  });

const resolveCurrentActor = <Project extends string, Action extends string>(
  access: ProjectAccessDefinition<Project, Action>,
) =>
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const session = yield* auth.requireSession();

    if (session.authMethod.type === "apiKey") {
      const apiKey = session.authMethod.apiKey;
      const grant = yield* Schema.decodeUnknownEffect(ApiKeyPermissionGrant)(
        apiKey.permissions ?? {},
      ).pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})));

      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) return yield* new HttpApiError.Unauthorized({});

      if (apiKey.configId === "organization") {
        return access.actorForApiKey({
          apiKeyId: apiKey.id,
          owner: { type: "organization", organizationId },
          grant,
        });
      }

      if (apiKey.configId === "user" && session.user) {
        const roles = yield* activeMemberRoles({
          organizationId,
          userId: session.user.id,
        });
        return access.actorForApiKey({
          apiKeyId: apiKey.id,
          owner: {
            type: "user",
            userId: session.user.id,
            organizationId,
            roles,
          },
          grant,
        });
      }

      return yield* new HttpApiError.Unauthorized({});
    }

    if (!session.user) return yield* new HttpApiError.Unauthorized({});
    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) return yield* new HttpApiError.Unauthorized({});
    const roles = yield* activeMemberRoles({
      organizationId,
      userId: session.user.id,
    });
    return access.actorForUser({
      userId: session.user.id,
      organizationId,
      roles,
    });
  });

class AnyActorRequired extends HttpApiMiddleware.Service<
  AnyActorRequired,
  {
    requires: AuthService;
    provides: CurrentActor;
  }
>()("@krak-stack/auth/ActorRequired", {
  error: [
    HttpApiError.Unauthorized,
    HttpApiError.Forbidden,
    HttpApiError.ServiceUnavailable,
  ],
}) {}

class UserActorRequired extends HttpApiMiddleware.Service<
  UserActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/User", {
  error: [
    HttpApiError.Unauthorized,
    HttpApiError.Forbidden,
    HttpApiError.ServiceUnavailable,
  ],
}) {}

class ApiKeyActorRequired extends HttpApiMiddleware.Service<
  ApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey", {
  error: [
    HttpApiError.Unauthorized,
    HttpApiError.Forbidden,
    HttpApiError.ServiceUnavailable,
  ],
}) {}

class UserApiKeyActorRequired extends HttpApiMiddleware.Service<
  UserApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey/User", {
  error: [
    HttpApiError.Unauthorized,
    HttpApiError.Forbidden,
    HttpApiError.ServiceUnavailable,
  ],
}) {}

class OrganizationApiKeyActorRequired extends HttpApiMiddleware.Service<
  OrganizationApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey/Organization", {
  error: [
    HttpApiError.Unauthorized,
    HttpApiError.Forbidden,
    HttpApiError.ServiceUnavailable,
  ],
}) {}

export type ActorConstraint =
  | { readonly type: "user" }
  | {
      readonly type: "apiKey";
      readonly ownerType?: "user" | "organization" | undefined;
    };

const matchesConstraint = (
  actor: CurrentActor,
  constraint: ActorConstraint | undefined,
) => {
  if (!constraint) return true;
  if (constraint.type === "user") return actor.actor.type === "user";
  return (
    actor.actor.type === "apiKey" &&
    (!constraint.ownerType || actor.actor.owner.type === constraint.ownerType)
  );
};

const requiredActor = <Project extends string, Action extends string>(
  access: ProjectAccessDefinition<Project, Action>,
  constraint?: ActorConstraint,
) =>
  resolveCurrentActor(access).pipe(
    Effect.flatMap((actor) =>
      matchesConstraint(actor, constraint)
        ? Effect.succeed(actor)
        : Effect.fail(new HttpApiError.Forbidden({})),
    ),
  );

const withCurrentActor = <A, E, R>(
  httpEffect: Effect.Effect<A, E, R | CurrentActor>,
  actor: CurrentActor,
) => {
  const userId =
    actor.actor.type === "user"
      ? actor.actor.userId
      : actor.actor.owner.type === "user"
        ? actor.actor.owner.userId
        : undefined;
  const attributes: Record<string, string> = {};
  if (actor.actor.type === "user") {
    attributes["app.actor.type"] = "user";
    attributes["app.actor.id"] = actor.actor.userId;
  } else {
    attributes["app.actor.type"] = "api_key";
    attributes["app.actor.id"] = actor.actor.apiKeyId;
    attributes["app.actor.owner.type"] = actor.actor.owner.type;
    attributes["app.actor.owner.id"] =
      actor.actor.owner.type === "user"
        ? actor.actor.owner.userId
        : actor.actor.owner.organizationId;
  }
  if (actor.organizationId)
    attributes["organization.id"] = actor.organizationId;
  if (userId) attributes["user.id"] = userId;

  const ownedAttribute = (key: string) =>
    key === "user.id" ||
    key === "organization.id" ||
    key.startsWith("app.actor.");
  const replaceAttribution = (
    annotations: Effect.Success<typeof References.CurrentLogAnnotations>,
  ) => ({
    ...Object.fromEntries(
      Object.entries(annotations).filter(([key]) => !ownedAttribute(key)),
    ),
    ...attributes,
  });
  return Effect.gen(function* () {
    const logs = yield* References.CurrentLogAnnotations;
    const spans = yield* References.TracerSpanAnnotations;
    const current = yield* Effect.currentSpan.pipe(Effect.option);
    if (Option.isSome(current)) {
      for (const key of current.value.attributes.keys()) {
        if (ownedAttribute(key) && attributes[key] === undefined) {
          // Tracer has no removeAttribute API. Clear stale current-span values
          // explicitly; handler logs and child spans omit these fields entirely.
          current.value.attribute(key, "");
        }
      }
    }
    yield* Effect.annotateCurrentSpan(attributes);
    return yield* httpEffect.pipe(
      Effect.provideService(CurrentActor, actor),
      Effect.provideService(
        References.TracerSpanAnnotations,
        replaceAttribution(spans),
      ),
      Effect.provideService(
        References.CurrentLogAnnotations,
        replaceAttribution(logs),
      ),
    );
  });
};

export function ActorRequired(): typeof AnyActorRequired;
export function ActorRequired(constraint: {
  readonly type: "user";
}): typeof UserActorRequired;
export function ActorRequired(constraint: {
  readonly type: "apiKey";
  readonly ownerType: "user";
}): typeof UserApiKeyActorRequired;
export function ActorRequired(constraint: {
  readonly type: "apiKey";
  readonly ownerType: "organization";
}): typeof OrganizationApiKeyActorRequired;
export function ActorRequired(constraint: {
  readonly type: "apiKey";
}): typeof ApiKeyActorRequired;
export function ActorRequired(constraint?: ActorConstraint) {
  if (!constraint) return AnyActorRequired;
  if (constraint.type === "user") return UserActorRequired;
  if (constraint.ownerType === "user") return UserApiKeyActorRequired;
  if (constraint.ownerType === "organization") {
    return OrganizationApiKeyActorRequired;
  }
  return ApiKeyActorRequired;
}

const actorRequiredLayer = <Project extends string, Action extends string>(
  access: ProjectAccessDefinition<Project, Action>,
) =>
  Layer.mergeAll(
    Layer.succeed(AnyActorRequired, (httpEffect) =>
      requiredActor(access).pipe(
        Effect.flatMap((actor) => withCurrentActor(httpEffect, actor)),
      ),
    ),
    Layer.succeed(UserActorRequired, (httpEffect) =>
      requiredActor(access, { type: "user" }).pipe(
        Effect.flatMap((actor) => withCurrentActor(httpEffect, actor)),
      ),
    ),
    Layer.succeed(ApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, { type: "apiKey" }).pipe(
        Effect.flatMap((actor) => withCurrentActor(httpEffect, actor)),
      ),
    ),
    Layer.succeed(UserApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, { type: "apiKey", ownerType: "user" }).pipe(
        Effect.flatMap((actor) => withCurrentActor(httpEffect, actor)),
      ),
    ),
    Layer.succeed(OrganizationApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, {
        type: "apiKey",
        ownerType: "organization",
      }).pipe(Effect.flatMap((actor) => withCurrentActor(httpEffect, actor))),
    ),
  );

ActorRequired.layer = actorRequiredLayer;
