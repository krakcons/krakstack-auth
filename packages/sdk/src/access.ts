import { Context, Effect, Schema } from "effect";

import { parseRoleList } from "./roles";

export const ApiKeyPermissionGrant = Schema.Record(
  Schema.String,
  Schema.Array(Schema.String),
).annotate({
  identifier: "ApiKeyPermissionGrant",
  title: "API key permission grant",
  description: "Better Auth resource and action permissions assigned to a key.",
});

export type ApiKeyPermissionGrant = typeof ApiKeyPermissionGrant.Type;

export type UserActor = {
  readonly type: "user";
  readonly userId: string;
  readonly organizationId: string | null;
  readonly roles: ReadonlyArray<string>;
};

export type ApiKeyOwner =
  | {
      readonly type: "user";
      readonly userId: string;
      readonly organizationId: string | null;
      readonly roles: ReadonlyArray<string>;
    }
  | {
      readonly type: "organization";
      readonly organizationId: string;
    };

export type ApiKeyActor = {
  readonly type: "apiKey";
  readonly apiKeyId: string;
  readonly owner: ApiKeyOwner;
};

export type Actor = UserActor | ApiKeyActor;

export type CurrentActor = {
  readonly actor: Actor;
  readonly organizationId: string | null;
  readonly permissions: ReadonlySet<string>;
};

export const CurrentActor = Context.Service<CurrentActor>(
  "@krak-stack/auth/CurrentActor",
);

export class Forbidden extends Schema.ErrorClass<Forbidden>("Forbidden")(
  {
    _tag: Schema.tag("Forbidden"),
  },
  {
    identifier: "Forbidden",
    title: "Forbidden",
    description: "The authenticated actor lacks a required permission.",
    httpApiStatus: 403,
  },
) {}

export type Policy<E = never, R = never> = Effect.Effect<
  void,
  Forbidden | E,
  CurrentActor | R
>;

export const policy = <E, R>(
  predicate: (actor: CurrentActor) => Effect.Effect<boolean, E, R>,
): Policy<E, R> =>
  Effect.flatMap(CurrentActor, (actor) =>
    Effect.flatMap(predicate(actor), (allowed) =>
      allowed ? Effect.void : Effect.fail(new Forbidden()),
    ),
  );

export const permission = (requiredPermission: string): Policy =>
  policy((actor) => Effect.succeed(actor.permissions.has(requiredPermission)));

export const actorUserId = CurrentActor.pipe(
  Effect.flatMap(({ actor }) => {
    if (actor.type === "user") return Effect.succeed(actor.userId);
    if (actor.owner.type === "user") return Effect.succeed(actor.owner.userId);
    return Effect.fail(new Forbidden());
  }),
);

export const all = <E, R>(
  ...policies: readonly [Policy<E, R>, ...Array<Policy<E, R>>]
): Policy<E, R> => Effect.all(policies, { concurrency: 1, discard: true });

export const any = <E, R>(
  ...policies: readonly [Policy<E, R>, ...Array<Policy<E, R>>]
): Policy<E, R> => Effect.firstSuccessOf(policies);

export const withPolicy =
  <E, R>(accessPolicy: Effect.Effect<void, E, R>) =>
  <A, E2, R2>(self: Effect.Effect<A, E2, R2>) =>
    Effect.andThen(accessPolicy, self);

type ProjectPermission<
  Project extends string,
  Action extends string,
> = `${Project}:${Action}`;

export type ProjectAccessDefinition<
  Project extends string = string,
  Action extends string = string,
> = {
  readonly project: Project;
  readonly actions: ReadonlyArray<Action>;
  readonly roles: Readonly<Record<string, ReadonlyArray<Action> | undefined>>;
  readonly apiKeys: {
    readonly user: ReadonlyArray<Action>;
    readonly organization: ReadonlyArray<Action>;
  };
  readonly qualify: (action: Action) => ProjectPermission<Project, Action>;
  readonly permission: (action: Action) => Policy;
  readonly permissionsForRoles: (
    roles: unknown,
  ) => ReadonlySet<ProjectPermission<Project, Action>>;
  readonly permissionsForGrant: (
    grant: ApiKeyPermissionGrant | null | undefined,
  ) => ReadonlySet<ProjectPermission<Project, Action>>;
  readonly permissionsForUserKey: (input: {
    readonly grant: ApiKeyPermissionGrant | null | undefined;
    readonly roles: unknown;
  }) => ReadonlySet<ProjectPermission<Project, Action>>;
  readonly decodeGrant: (
    input: unknown,
  ) => Effect.Effect<
    ReadonlySet<ProjectPermission<Project, Action>>,
    Schema.SchemaError
  >;
  readonly encodeGrant: (
    actions: ReadonlyArray<Action>,
  ) => ApiKeyPermissionGrant;
  readonly apiKeyPermissions: {
    readonly user: ApiKeyPermissionGrant;
    readonly organization: ApiKeyPermissionGrant;
  };
  readonly actorForUser: (input: {
    readonly userId: string;
    readonly organizationId: string | null;
    readonly roles: unknown;
  }) => CurrentActor;
  readonly actorForApiKey: (input: {
    readonly apiKeyId: string;
    readonly owner: ApiKeyOwner;
    readonly grant: ApiKeyPermissionGrant | null | undefined;
  }) => CurrentActor;
};

export type ProjectAccessCatalog = Pick<
  ProjectAccessDefinition,
  "project" | "roles" | "apiKeyPermissions"
>;

export type ProjectAccessLabelCatalog = {
  readonly project: string;
  readonly roles: Readonly<Record<string, string | undefined>>;
  readonly permissions: Readonly<
    Record<
      string,
      {
        readonly label: string;
        readonly actions: Readonly<Record<string, string>>;
      }
    >
  >;
};

type PermissionResource<Action extends string> =
  Action extends `${infer Resource}:${string}` ? Resource : Action;

type PermissionAction<
  Action extends string,
  Resource extends string,
> = Action extends `${Resource}:${infer Value}` ? Value : never;

export type ProjectAccessLabels<
  Action extends string = string,
  Role extends string = string,
> = {
  readonly project: string;
  readonly roles: Readonly<Partial<Record<Role, string>>>;
  readonly permissions: {
    readonly [Resource in PermissionResource<Action>]: {
      readonly label: string;
      readonly actions: Readonly<
        Record<PermissionAction<Action, Resource>, string>
      >;
    };
  };
};

export type ProjectAccessConfig<
  Project extends string,
  Permissions extends ReadonlyArray<string>,
> = {
  readonly project: Project;
  readonly permissions: Permissions;
  readonly roles: Readonly<
    Record<string, ReadonlyArray<Permissions[number]> | undefined>
  >;
  readonly apiKeys?: {
    readonly user?: ReadonlyArray<Permissions[number]>;
    readonly organization?: ReadonlyArray<Permissions[number]>;
  };
};

const intersection = <A>(
  left: ReadonlySet<A>,
  right: ReadonlySet<A>,
): ReadonlySet<A> =>
  new Set(Array.from(left).filter((item) => right.has(item)));

const roleList = (input: unknown): ReadonlyArray<string> =>
  Array.isArray(input)
    ? input.flatMap((role) => parseRoleList(role))
    : parseRoleList(input);

export const defineProjectAccess = <
  const Project extends string,
  const Permissions extends ReadonlyArray<string>,
>(
  config: ProjectAccessConfig<Project, Permissions>,
): ProjectAccessDefinition<Project, Permissions[number]> => {
  type Action = Permissions[number];
  type QualifiedPermission = ProjectPermission<Project, Action>;

  const allowedActions = new Set<Action>(config.permissions);
  const qualify = (action: Action) =>
    `${config.project}:${action}` as QualifiedPermission;

  const permissionsForActions = (
    actions: Iterable<Action>,
  ): ReadonlySet<QualifiedPermission> =>
    new Set(Array.from(actions, (action) => qualify(action)));

  const permissionsForRoles = (
    input: unknown,
  ): ReadonlySet<QualifiedPermission> => {
    const actions = new Set<Action>();
    for (const role of roleList(input)) {
      for (const action of config.roles[role] ?? []) {
        if (allowedActions.has(action)) actions.add(action);
      }
    }
    return permissionsForActions(actions);
  };

  const permissionsForGrant = (
    grant: ApiKeyPermissionGrant | null | undefined,
  ): ReadonlySet<QualifiedPermission> => {
    const actions = (grant?.[config.project] ?? []).filter((action) =>
      allowedActions.has(action as Action),
    ) as Array<Action>;
    return permissionsForActions(actions);
  };

  const encodeGrant = (
    actions: ReadonlyArray<Action>,
  ): ApiKeyPermissionGrant => ({
    [config.project]: actions.filter((action) => allowedActions.has(action)),
  });

  const userApiKeyActions = (config.apiKeys?.user ?? []).filter((action) =>
    allowedActions.has(action),
  );
  const organizationApiKeyActions = (config.apiKeys?.organization ?? []).filter(
    (action) => allowedActions.has(action),
  );
  const actorForUser = (input: {
    readonly userId: string;
    readonly organizationId: string | null;
    readonly roles: unknown;
  }): CurrentActor => {
    const roles = roleList(input.roles);
    return {
      actor: {
        type: "user",
        userId: input.userId,
        organizationId: input.organizationId,
        roles,
      },
      organizationId: input.organizationId,
      permissions: permissionsForRoles(roles),
    };
  };

  const actorForApiKey = (input: {
    readonly apiKeyId: string;
    readonly owner: ApiKeyOwner;
    readonly grant: ApiKeyPermissionGrant | null | undefined;
  }): CurrentActor => {
    const keyPermissions = permissionsForGrant(input.grant);
    const permissions = (() => {
      switch (input.owner.type) {
        case "user":
          return intersection(
            intersection(
              permissionsForRoles(input.owner.roles),
              permissionsForActions(userApiKeyActions),
            ),
            keyPermissions,
          );
        case "organization":
          return intersection(
            permissionsForActions(organizationApiKeyActions),
            keyPermissions,
          );
      }
    })();

    return {
      actor: {
        type: "apiKey",
        apiKeyId: input.apiKeyId,
        owner: input.owner,
      },
      organizationId: input.owner.organizationId,
      permissions,
    };
  };

  return {
    project: config.project,
    actions: config.permissions,
    roles: config.roles,
    apiKeys: {
      user: userApiKeyActions,
      organization: organizationApiKeyActions,
    },
    qualify,
    permission: (action) => permission(qualify(action)),
    permissionsForRoles,
    permissionsForGrant,
    permissionsForUserKey: ({ grant, roles }) =>
      intersection(
        intersection(
          permissionsForRoles(roles),
          permissionsForActions(userApiKeyActions),
        ),
        permissionsForGrant(grant),
      ),
    decodeGrant: (input) =>
      Schema.decodeUnknownEffect(ApiKeyPermissionGrant)(input).pipe(
        Effect.map(permissionsForGrant),
      ),
    encodeGrant,
    apiKeyPermissions: {
      user: encodeGrant(userApiKeyActions),
      organization: encodeGrant(organizationApiKeyActions),
    },
    actorForUser,
    actorForApiKey,
  };
};

export const defineProjectAccessLabels = <
  const Action extends string,
  const Role extends string,
>(
  _access: {
    readonly actions: ReadonlyArray<Action>;
    readonly roles: Readonly<Record<Role, ReadonlyArray<Action> | undefined>>;
  },
  labels: ProjectAccessLabels<Action, Role>,
) => labels;
