import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, Redacted, References, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";

import { CurrentActor, defineProjectAccess } from "../access.js";
import {
  AuthService,
  type AuthSession,
  type AuthSessionWithOrganization,
} from "../service.js";
import { ActorRequired } from "./actor.js";

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

interface ExpectedActorAttributes {
  organizationId: string;
  userId?: string;
  actorType: "user" | "api_key";
  actorId: string;
  ownerType?: "user" | "organization";
  ownerId?: string;
}

const expectedAttribution = (expected: ExpectedActorAttributes) => ({
  "organization.id": expected.organizationId,
  "user.id": expected.userId,
  "app.actor.type": expected.actorType,
  "app.actor.id": expected.actorId,
  "app.actor.owner.type": expected.ownerType,
  "app.actor.owner.id": expected.ownerId,
});

const expectActorSpanAttributes = (expected: ExpectedActorAttributes) =>
  Effect.gen(function* () {
    const requestSpan = yield* Effect.currentSpan;
    const childSpan = yield* Effect.currentSpan.pipe(
      Effect.withSpan("authenticated-child"),
    );
    for (const [key, value] of Object.entries(expectedAttribution(expected))) {
      expect(requestSpan.attributes.get(key)).toBe(value);
      expect(childSpan.attributes.get(key)).toBe(value);
    }
  }).pipe(Effect.orDie);

const expectActorLogAttributes = (expected: ExpectedActorAttributes) => {
  const annotations: Array<Record<string, typeof Schema.Unknown.Type>> = [];
  const logger = Logger.make((options) => {
    annotations.push(options.fiber.getRef(References.CurrentLogAnnotations));
  });

  return Effect.log("authenticated event").pipe(
    Effect.withLogger(logger),
    Effect.andThen(
      Effect.sync(() => {
        expect(annotations).toHaveLength(1);
        for (const [key, value] of Object.entries(
          expectedAttribution(expected),
        )) {
          expect(annotations[0]?.[key]).toBe(value);
        }
        expect(annotations[0]).not.toHaveProperty("session.token");
        expect(JSON.stringify(annotations[0])).not.toContain("session-token");
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
          actorType: "user",
          actorId: "user-1",
          organizationId: "org-1",
          userId: "user-1",
        });
        yield* expectActorLogAttributes({
          actorType: "user",
          actorId: "user-1",
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
  for (const scenario of [
    {
      name: "organization key",
      session: organizationKeySession,
      expected: {
        "app.actor.type": "api_key",
        "app.actor.id": "organization-key-1",
        "app.actor.owner.type": "organization",
        "app.actor.owner.id": "org-1",
        "user.id": undefined,
        "organization.id": "org-1",
      },
    },
    {
      name: "user",
      session: userSession,
      expected: {
        "app.actor.type": "user",
        "app.actor.id": "user-1",
        "app.actor.owner.type": undefined,
        "app.actor.owner.id": undefined,
        "user.id": "user-1",
        "organization.id": "org-1",
      },
    },
  ]) {
    it.effect(
      `replaces stale attribution for a ${scenario.name} while preserving unrelated context`,
      () => {
        const ambient = {
          "user.id": "previous-user",
          "organization.id": "previous-org",
          "app.actor.type": "api_key",
          "app.actor.id": "previous-key",
          "app.actor.owner.type": "user",
          "app.actor.owner.id": "previous-owner",
          "app.actor.delegated_by": "previous-delegator",
          "mcp.method.name": "tools/call",
          "request.id": "request-1",
        };
        return Effect.gen(function* () {
          const middleware = yield* ActorRequired();
          const logsBefore = yield* References.CurrentLogAnnotations;
          const spansBefore = yield* References.TracerSpanAnnotations;
          yield* Effect.annotateCurrentSpan(ambient);
          yield* middleware(
            Effect.gen(function* () {
              const logs = yield* References.CurrentLogAnnotations;
              const current = yield* Effect.currentSpan;
              const child = yield* Effect.currentSpan.pipe(
                Effect.withSpan("authenticated-child"),
              );
              for (const [key, value] of Object.entries(scenario.expected)) {
                expect(logs[key]).toBe(value);
                expect(child.attributes.get(key)).toBe(value);
                expect(current.attributes.get(key)).toBe(value ?? "");
              }
              expect(logs).not.toHaveProperty("app.actor.delegated_by");
              expect(child.attributes.has("app.actor.delegated_by")).toBe(
                false,
              );
              expect(current.attributes.get("app.actor.delegated_by")).toBe("");
              expect(logs["mcp.method.name"]).toBe("tools/call");
              expect(child.attributes.get("request.id")).toBe("request-1");
              return HttpServerResponse.empty();
            }),
            middlewareOptions,
          );
          expect(yield* References.CurrentLogAnnotations).toEqual(logsBefore);
          expect(yield* References.TracerSpanAnnotations).toEqual(spansBefore);
        }).pipe(
          Effect.provide(ActorRequired.layer(Access)),
          Effect.provide(authServiceLayer(scenario.session)),
          Effect.annotateLogs(ambient),
          Effect.annotateSpans(ambient),
          provideRequestContext,
        );
      },
    );
  }

  it.effect(
    "scopes verified attribution to the authenticated handler and overrides ambient actor claims",
    () =>
      Effect.gen(function* () {
        const middleware = yield* ActorRequired();
        const before = yield* References.CurrentLogAnnotations;
        yield* middleware(
          Effect.gen(function* () {
            const annotations = yield* References.CurrentLogAnnotations;
            expect(annotations["app.actor.type"]).toBe("api_key");
            expect(annotations["app.actor.id"]).toBe("user-key-1");
            expect(annotations["app.actor.owner.id"]).toBe("user-1");
            expect(annotations["request.id"]).toBe("request-1");
            return HttpServerResponse.empty();
          }),
          middlewareOptions,
        );
        expect(yield* References.CurrentLogAnnotations).toEqual(before);
      }).pipe(
        Effect.provide(ActorRequired.layer(Access)),
        Effect.provide(authServiceLayer(userKeySession)),
        Effect.annotateLogs({
          "app.actor.type": "system",
          "app.actor.id": "unverified",
          "request.id": "request-1",
        }),
        provideRequestContext,
      ),
  );

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
            actorType: "api_key",
            actorId: "user-key-1",
            ownerType: "user",
            ownerId: "user-1",
            organizationId: "org-1",
            userId: "user-1",
          });
          yield* expectActorLogAttributes({
            actorType: "api_key",
            actorId: "user-key-1",
            ownerType: "user",
            ownerId: "user-1",
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
          yield* expectActorSpanAttributes({
            organizationId: "org-1",
            actorType: "api_key",
            actorId: "organization-key-1",
            ownerType: "organization",
            ownerId: "org-1",
          });
          yield* expectActorLogAttributes({
            organizationId: "org-1",
            actorType: "api_key",
            actorId: "organization-key-1",
            ownerType: "organization",
            ownerId: "org-1",
          });
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
