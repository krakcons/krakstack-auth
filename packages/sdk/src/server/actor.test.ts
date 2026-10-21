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
import { AuthMiddleware } from "./middleware.js";

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
  actorType: "user" | "organization";
  actorId: string;
  credentialId?: string;
}

const expectedAttribution = (expected: ExpectedActorAttributes) => ({
  "organization.id": expected.organizationId,
  "user.id": expected.userId,
  "app.actor.type": expected.actorType,
  "app.actor.id": expected.actorId,
  "app.auth.method": expected.credentialId ? "api_key" : "session",
  "app.auth.credential.id": expected.credentialId,
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
  getSession: () => Effect.succeed<AuthSession>(authSession),
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

const withAuthentication = (
  httpEffect: Parameters<AuthMiddleware["Service"]["apiKey"]>[0],
) =>
  Effect.gen(function* () {
    const middleware = yield* AuthMiddleware;
    return yield* middleware.apiKey(httpEffect, {
      ...middlewareOptions,
      credential: Redacted.make(""),
    });
  });

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
    ).pipe(withAuthentication);
  }).pipe(
    Effect.provide(ActorRequired.layer(Access)),
    Effect.provide(AuthMiddleware.layer(authServiceLayer(authSession))),
    provideRequestContext,
  );

describe("ActorRequired", () => {
  it.effect(
    "adds verified roles without reconstructing session attribution",
    () =>
      Effect.gen(function* () {
        const middleware = yield* ActorRequired();
        const logs = yield* References.CurrentLogAnnotations;
        const spans = yield* References.TracerSpanAnnotations;
        const current = yield* Effect.currentSpan;
        const attributes = new Map(current.attributes);

        return yield* middleware(
          Effect.gen(function* () {
            const actor = yield* CurrentActor;
            expect(actor.actor.type).toBe("user");
            expect(actor.permissions.has("test:records:read")).toBe(true);
            expect(yield* References.CurrentLogAnnotations).toEqual({
              ...logs,
              "user.roles": ["member"],
            });
            expect(yield* References.TracerSpanAnnotations).toEqual({
              ...spans,
              "user.roles": ["member"],
            });
            expect(current.attributes).toEqual(
              new Map([...attributes, ["user.roles", ["member"]]]),
            );
            return HttpServerResponse.empty();
          }),
          middlewareOptions,
        );
      }).pipe(
        Effect.provide(ActorRequired.layer(Access)),
        Effect.provide(authServiceLayer(userSession)),
        Effect.annotateLogs({ "request.id": "request-1" }),
        Effect.annotateSpans({ "request.id": "request-1" }),
        provideRequestContext,
      ),
  );

  for (const scenario of [
    {
      name: "organization key",
      session: organizationKeySession,
      expected: {
        "app.actor.type": "organization",
        "app.actor.id": "org-1",
        "app.auth.method": "api_key",
        "app.auth.credential.id": "organization-key-1",
        "app.auth.impersonator.id": undefined,
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
        "app.auth.method": "session",
        "app.auth.credential.id": undefined,
        "app.auth.impersonator.id": undefined,
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
          "app.actor.type": "user",
          "app.actor.id": "previous-user",
          "app.auth.method": "api_key",
          "app.auth.credential.id": "previous-key",
          "app.auth.impersonator.id": "previous-admin",
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
          ).pipe(withAuthentication);
          expect(yield* References.CurrentLogAnnotations).toEqual(logsBefore);
          expect(yield* References.TracerSpanAnnotations).toEqual(spansBefore);
        }).pipe(
          Effect.provide(ActorRequired.layer(Access)),
          Effect.provide(
            AuthMiddleware.layer(authServiceLayer(scenario.session)),
          ),
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
            expect(annotations["app.actor.type"]).toBe("user");
            expect(annotations["app.actor.id"]).toBe("user-1");
            expect(annotations["app.auth.method"]).toBe("api_key");
            expect(annotations["app.auth.credential.id"]).toBe("user-key-1");
            expect(annotations["request.id"]).toBe("request-1");
            return HttpServerResponse.empty();
          }),
          middlewareOptions,
        ).pipe(withAuthentication);
        expect(yield* References.CurrentLogAnnotations).toEqual(before);
      }).pipe(
        Effect.provide(ActorRequired.layer(Access)),
        Effect.provide(AuthMiddleware.layer(authServiceLayer(userKeySession))),
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

  for (const scenario of [
    { name: "member", session: userSession, roles: ["member"] },
    { name: "user key", session: userKeySession, roles: ["member"] },
    { name: "organization key", session: organizationKeySession, roles: [] },
  ]) {
    it.effect(
      `snapshots verified organization roles for a ${scenario.name}`,
      () =>
        Effect.gen(function* () {
          const middleware = yield* ActorRequired();
          yield* middleware(
            Effect.gen(function* () {
              const annotations = yield* References.CurrentLogAnnotations;
              expect(annotations["user.roles"]).toEqual(scenario.roles);
              const current = yield* Effect.currentSpan;
              const child = yield* Effect.currentSpan.pipe(
                Effect.withSpan("role-snapshot"),
              );
              expect(current.attributes.get("user.roles")).toEqual(
                scenario.roles,
              );
              expect(child.attributes.get("user.roles")).toEqual(
                scenario.roles,
              );
              if (scenario.name === "organization key") {
                expect(annotations).not.toHaveProperty("user.full_name");
                expect(annotations).not.toHaveProperty("user.email");
              } else {
                expect(annotations["user.full_name"]).toBe(user.name);
                expect(annotations["user.email"]).toBe(user.email);
              }
              expect(annotations).not.toHaveProperty("app.user.image");
              return HttpServerResponse.empty();
            }),
            middlewareOptions,
          ).pipe(withAuthentication);
        }).pipe(
          Effect.provide(ActorRequired.layer(Access)),
          Effect.provide(
            AuthMiddleware.layer(authServiceLayer(scenario.session)),
          ),
          Effect.annotateLogs({ "user.roles": ["owner"] }),
          provideRequestContext,
        ),
    );
  }

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
            actorType: "user",
            actorId: "user-1",
            credentialId: "user-key-1",
            organizationId: "org-1",
            userId: "user-1",
          });
          yield* expectActorLogAttributes({
            actorType: "user",
            actorId: "user-1",
            credentialId: "user-key-1",
            organizationId: "org-1",
            userId: "user-1",
          });
          return HttpServerResponse.empty();
        }),
        middlewareOptions,
      ).pipe(withAuthentication);
    }).pipe(
      Effect.provide(ActorRequired.layer(Access)),
      Effect.provide(AuthMiddleware.layer(authServiceLayer(userKeySession))),
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
            actorType: "organization",
            actorId: "org-1",
            credentialId: "organization-key-1",
          });
          yield* expectActorLogAttributes({
            organizationId: "org-1",
            actorType: "organization",
            actorId: "org-1",
            credentialId: "organization-key-1",
          });
          return HttpServerResponse.empty();
        }),
        middlewareOptions,
      ).pipe(withAuthentication);
    }).pipe(
      Effect.provide(ActorRequired.layer(Access)),
      Effect.provide(
        AuthMiddleware.layer(authServiceLayer(organizationKeySession)),
      ),
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
