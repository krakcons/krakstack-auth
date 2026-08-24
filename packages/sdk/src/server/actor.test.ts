import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, Redacted, References, Schema } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import { CurrentActor, defineProjectAccess } from "../access";
import {
  AuthService,
  type AuthSession,
  type AuthSessionWithOrganization,
} from "../service";
import { ActorRequired } from "./actor";

const now = new Date("2026-01-01T00:00:00.000Z");

const user = {
  id: "user-1",
  createdAt: now,
  updatedAt: now,
  email: "user@example.com",
  emailVerified: true,
  image: null,
  name: "Test User",
  role: null,
  banned: false,
};

const session = {
  id: "session-1",
  createdAt: now,
  updatedAt: now,
  userId: user.id,
  expiresAt: new Date("2026-01-02T00:00:00.000Z"),
  token: "session-token",
  activeOrganizationId: "org-1",
};

const apiKey = ({
  configId,
  permissions,
}: {
  configId: "user" | "organization" | "service";
  permissions: Record<string, ReadonlyArray<string>>;
}) => ({
  id: `${configId}-key-1`,
  configId,
  name: `${configId} key`,
  start: `${configId}_1234`,
  prefix: `${configId}_`,
  referenceId: configId === "user" ? user.id : "org-1",
  enabled: true,
  expiresAt: null,
  createdAt: now,
  updatedAt: now,
  permissions,
  metadata: null,
});

const userSession = {
  session,
  user,
  isSuperAdminImpersonation: false,
  authMethod: { type: "cookie" },
} satisfies AuthSession;

const userKeySession = {
  session: { ...session, id: "user-key-session", token: "user-key-1" },
  user,
  isSuperAdminImpersonation: false,
  authMethod: {
    type: "apiKey",
    apiKey: apiKey({
      configId: "user",
      permissions: { test: ["records:read", "records:update"] },
    }),
  },
} satisfies AuthSession;

const organizationKeySession = {
  session: {
    ...session,
    id: "organization-key-session",
    token: "organization-key-1",
    userId: "api-key:organization-key-1",
  },
  user: undefined,
  isSuperAdminImpersonation: false,
  authMethod: {
    type: "apiKey",
    apiKey: apiKey({
      configId: "organization",
      permissions: { test: ["records:update"] },
    }),
  },
} satisfies AuthSession;

const Access = defineProjectAccess({
  project: "test",
  permissions: ["records:read", "records:update"],
  roles: {
    member: ["records:read"],
    owner: ["records:read", "records:update"],
  },
  apiKeys: {
    user: ["records:read", "records:update"],
    organization: ["records:read", "records:update"],
  },
});

const middlewareOptions = {
  endpoint: HttpApiEndpoint.get("test", "/test"),
  group: HttpApiGroup.make("test"),
};

const request = HttpServerRequest.fromWeb(new Request("http://localhost/test"));
const routeContext = {
  params: {},
  route: HttpRouter.route("GET", "/test", HttpServerResponse.empty()),
};
const provideRequestContext = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
    Effect.provideService(HttpRouter.RouteContext, routeContext),
    Effect.withSpan("http.server GET"),
  );

const expectActorSpanAttributes = ({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId?: string;
}) =>
  Effect.gen(function* () {
    const requestSpan = yield* Effect.currentSpan;
    expect(requestSpan.attributes.get("organization.id")).toBe(organizationId);
    expect(requestSpan.attributes.get("user.id")).toBe(userId);

    const childSpan = yield* Effect.currentSpan.pipe(
      Effect.withSpan("authenticated-child"),
    );
    expect(childSpan.attributes.get("organization.id")).toBe(organizationId);
    expect(childSpan.attributes.get("user.id")).toBe(userId);
  }).pipe(Effect.orDie);

const expectActorLogAttributes = ({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId?: string;
}) => {
  const annotations: Array<Record<string, typeof Schema.Unknown.Type>> = [];
  const logger = Logger.make((options) => {
    annotations.push(options.fiber.getRef(References.CurrentLogAnnotations));
  });

  return Effect.log("authenticated event").pipe(
    Effect.withLogger(logger),
    Effect.andThen(
      Effect.sync(() => {
        expect(annotations).toHaveLength(1);
        expect(annotations[0]?.["organization.id"]).toBe(organizationId);
        expect(annotations[0]?.["user.id"]).toBe(userId);
      }),
    ),
    Effect.orDie,
  );
};

const authService = (authSession: AuthSession) => ({
  requireSession: () => Effect.succeed<AuthSession>(authSession),
  requireOrganization: () =>
    Effect.succeed<AuthSessionWithOrganization>({
      ...authSession,
      session: {
        ...authSession.session,
        activeOrganizationId:
          authSession.session.activeOrganizationId ?? "org-1",
      },
    }),
  getActiveMemberRole: () => Effect.succeed("member"),
});

const authServiceLayer = (authSession: AuthSession) =>
  Layer.effect(
    AuthService,
    Effect.map(AuthService, (service) => ({
      ...service,
      ...authService(authSession),
    })),
  ).pipe(
    Layer.provide(
      AuthService.layer({
        baseUrl: "http://localhost",
        apiKey: Redacted.make("test-service-key"),
      }),
    ),
  );

const runAnyActorMiddleware = (authSession: AuthSession) =>
  Effect.gen(function* () {
    const middleware = yield* ActorRequired();

    return yield* middleware(
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        expect(actor.actor.type).toBe("user");
        expect(actor.permissions.has("test:records:read")).toBe(true);
        expect(actor.permissions.has("test:records:update")).toBe(false);
        yield* expectActorSpanAttributes({
          organizationId: "org-1",
          userId: "user-1",
        });
        yield* expectActorLogAttributes({
          organizationId: "org-1",
          userId: "user-1",
        });
        return HttpServerResponse.empty();
      }),
      middlewareOptions,
    );
  }).pipe(
    Effect.provide(ActorRequired.layer(Access)),
    Effect.provide(authServiceLayer(authSession)),
    provideRequestContext,
  );

describe("ActorRequired", () => {
  it.effect("resolves a member using live organization roles", () =>
    runAnyActorMiddleware(userSession),
  );

  it.effect("intersects a user key grant with the live member role", () =>
    Effect.gen(function* () {
      const middleware = yield* ActorRequired({
        type: "apiKey",
        ownerType: "user",
      });

      return yield* middleware(
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          expect(actor.actor.type).toBe("apiKey");
          expect(actor.permissions.has("test:records:read")).toBe(true);
          expect(actor.permissions.has("test:records:update")).toBe(false);
          yield* expectActorSpanAttributes({
            organizationId: "org-1",
            userId: "user-1",
          });
          yield* expectActorLogAttributes({
            organizationId: "org-1",
            userId: "user-1",
          });
          return HttpServerResponse.empty();
        }),
        middlewareOptions,
      );
    }).pipe(
      Effect.provide(ActorRequired.layer(Access)),
      Effect.provide(authServiceLayer(userKeySession)),
      provideRequestContext,
    ),
  );

  it.effect("resolves an organization key from its explicit grant", () =>
    Effect.gen(function* () {
      const middleware = yield* ActorRequired({
        type: "apiKey",
        ownerType: "organization",
      });

      return yield* middleware(
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          expect(actor.actor.type).toBe("apiKey");
          expect(actor.permissions.has("test:records:read")).toBe(false);
          expect(actor.permissions.has("test:records:update")).toBe(true);
          yield* expectActorSpanAttributes({ organizationId: "org-1" });
          yield* expectActorLogAttributes({ organizationId: "org-1" });
          return HttpServerResponse.empty();
        }),
        middlewareOptions,
      );
    }).pipe(
      Effect.provide(ActorRequired.layer(Access)),
      Effect.provide(authServiceLayer(organizationKeySession)),
      provideRequestContext,
    ),
  );

  it.effect("rejects an organization key from a user-only endpoint", () =>
    Effect.gen(function* () {
      const middleware = yield* ActorRequired({ type: "user" });
      return yield* middleware(
        Effect.succeed(HttpServerResponse.empty()),
        middlewareOptions,
      );
    }).pipe(
      Effect.provide(ActorRequired.layer(Access)),
      Effect.provide(authServiceLayer(organizationKeySession)),
      provideRequestContext,
      Effect.flip,
      Effect.map((error) => {
        expect(error).toBeInstanceOf(HttpApiError.Forbidden);
      }),
    ),
  );

  it.effect("rejects a user key from an organization-key endpoint", () =>
    Effect.gen(function* () {
      const middleware = yield* ActorRequired({
        type: "apiKey",
        ownerType: "organization",
      });
      return yield* middleware(
        Effect.succeed(HttpServerResponse.empty()),
        middlewareOptions,
      );
    }).pipe(
      Effect.provide(ActorRequired.layer(Access)),
      Effect.provide(authServiceLayer(userKeySession)),
      provideRequestContext,
      Effect.flip,
      Effect.map((error) => {
        expect(error).toBeInstanceOf(HttpApiError.Forbidden);
      }),
    ),
  );
});
