import { Effect, Layer, Schema } from "effect";
import { HttpApiError, HttpApiMiddleware } from "effect/unstable/httpapi";

import {
  ApiKeyPermissionGrant,
  CurrentActor,
  type ProjectAccessDefinition,
} from "../access";
import { parseRoleList } from "../roles";
import { AuthService } from "../service";

const activeMemberRoles = ({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const member = yield* auth.organizations
      .getActiveMember({ params: { organizationId, userId } })
      .pipe(Effect.mapError(() => new HttpApiError.Forbidden({})));
    return parseRoleList(member.role);
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

      if (apiKey.configId === "service") {
        return access.actorForApiKey({
          apiKeyId: apiKey.id,
          owner: { type: "service", serviceId: apiKey.referenceId },
          grant,
        });
      }

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
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

class UserActorRequired extends HttpApiMiddleware.Service<
  UserActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/User", {
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

class ApiKeyActorRequired extends HttpApiMiddleware.Service<
  ApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey", {
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

class UserApiKeyActorRequired extends HttpApiMiddleware.Service<
  UserApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey/User", {
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

class OrganizationApiKeyActorRequired extends HttpApiMiddleware.Service<
  OrganizationApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey/Organization", {
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

class ServiceApiKeyActorRequired extends HttpApiMiddleware.Service<
  ServiceApiKeyActorRequired,
  { requires: AuthService; provides: CurrentActor }
>()("@krak-stack/auth/ActorRequired/ApiKey/Service", {
  error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

export type ActorConstraint =
  | { readonly type: "user" }
  | {
      readonly type: "apiKey";
      readonly ownerType?: "user" | "organization" | "service" | undefined;
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

const actorRequired = (constraint?: ActorConstraint) => {
  if (!constraint) return AnyActorRequired;
  if (constraint.type === "user") return UserActorRequired;
  if (constraint.ownerType === "user") return UserApiKeyActorRequired;
  if (constraint.ownerType === "organization") {
    return OrganizationApiKeyActorRequired;
  }
  if (constraint.ownerType === "service") return ServiceApiKeyActorRequired;
  return ApiKeyActorRequired;
};

const actorRequiredLayer = <Project extends string, Action extends string>(
  access: ProjectAccessDefinition<Project, Action>,
) =>
  Layer.mergeAll(
    Layer.succeed(AnyActorRequired, (httpEffect) =>
      requiredActor(access).pipe(
        Effect.flatMap((actor) =>
          httpEffect.pipe(Effect.provideService(CurrentActor, actor)),
        ),
      ),
    ),
    Layer.succeed(UserActorRequired, (httpEffect) =>
      requiredActor(access, { type: "user" }).pipe(
        Effect.flatMap((actor) =>
          httpEffect.pipe(Effect.provideService(CurrentActor, actor)),
        ),
      ),
    ),
    Layer.succeed(ApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, { type: "apiKey" }).pipe(
        Effect.flatMap((actor) =>
          httpEffect.pipe(Effect.provideService(CurrentActor, actor)),
        ),
      ),
    ),
    Layer.succeed(UserApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, { type: "apiKey", ownerType: "user" }).pipe(
        Effect.flatMap((actor) =>
          httpEffect.pipe(Effect.provideService(CurrentActor, actor)),
        ),
      ),
    ),
    Layer.succeed(OrganizationApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, {
        type: "apiKey",
        ownerType: "organization",
      }).pipe(
        Effect.flatMap((actor) =>
          httpEffect.pipe(Effect.provideService(CurrentActor, actor)),
        ),
      ),
    ),
    Layer.succeed(ServiceApiKeyActorRequired, (httpEffect) =>
      requiredActor(access, {
        type: "apiKey",
        ownerType: "service",
      }).pipe(
        Effect.flatMap((actor) =>
          httpEffect.pipe(Effect.provideService(CurrentActor, actor)),
        ),
      ),
    ),
  );

type ActorRequiredFactory = {
  (): typeof AnyActorRequired;
  (constraint: { readonly type: "user" }): typeof UserActorRequired;
  (constraint: {
    readonly type: "apiKey";
    readonly ownerType: "user";
  }): typeof UserApiKeyActorRequired;
  (constraint: {
    readonly type: "apiKey";
    readonly ownerType: "organization";
  }): typeof OrganizationApiKeyActorRequired;
  (constraint: {
    readonly type: "apiKey";
    readonly ownerType: "service";
  }): typeof ServiceApiKeyActorRequired;
  (constraint: { readonly type: "apiKey" }): typeof ApiKeyActorRequired;
  readonly layer: typeof actorRequiredLayer;
};

export const ActorRequired = Object.assign(actorRequired, {
  layer: actorRequiredLayer,
}) as ActorRequiredFactory;
