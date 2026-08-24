import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
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

import { AuthService } from "../service";
import { AuthMiddleware, makeAuthenticationLive } from "./middleware";
import type { AuthSession } from "../service";

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

const authSession = {
  session: {
    id: "session-1",
    createdAt: now,
    updatedAt: now,
    userId: "user-1",
    expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    token: "session-token",
    activeOrganizationId: "org-1",
  },
  user,
  isSuperAdminImpersonation: false,
  authMethod: { type: "cookie" },
} satisfies AuthSession;

const organizationImpersonationSession = {
  ...authSession,
  session: {
    ...authSession.session,
    impersonatedBy: "admin-user-1",
    impersonatedByOrganizationId: "org-1",
  },
} satisfies AuthSession;

const userApiKey = {
  id: "user-key-1",
  configId: "user",
  name: "User key",
  start: "user_1234",
  prefix: "user_",
  referenceId: "user-1",
  enabled: true,
  expiresAt: null,
  createdAt: now,
  updatedAt: now,
  permissions: null,
  metadata: null,
};

const organizationApiKey = {
  id: "org-key-1",
  configId: "organization",
  name: "Organization key",
  start: "org_1234",
  prefix: "org_",
  referenceId: "org-1",
  enabled: true,
  expiresAt: null,
  createdAt: now,
  updatedAt: now,
  permissions: null,
  metadata: null,
};

const middlewareOptions = {
  endpoint: HttpApiEndpoint.get("test", "/test", {
    error: HttpApiError.Unauthorized,
  }),
  group: HttpApiGroup.make("test"),
};

const request = HttpServerRequest.fromWeb(new Request("http://localhost/test"));
const postRequest = HttpServerRequest.fromWeb(
  new Request("http://localhost/test", { method: "POST" }),
);
const dynamicRequest = HttpServerRequest.fromWeb(
  new Request("http://localhost/api/learner/collections/collection-1/courses"),
);
const dynamicPostRequest = HttpServerRequest.fromWeb(
  new Request("http://localhost/api/learner/collections/collection-1/courses", {
    method: "POST",
  }),
);

const routeContext = {
  params: {},
  route: HttpRouter.route("GET", "/test", HttpServerResponse.text("ok")),
};

const provideRequestContext = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  provideRequestContextWith(request, effect);

const provideRequestContextWith = <A, E, R>(
  request: HttpServerRequest.HttpServerRequest,
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
    Effect.provideService(HttpRouter.RouteContext, routeContext),
  );

const authClient = {
  getSession: () => Effect.succeed<AuthSession>(authSession),
  requireSession: () => Effect.succeed<AuthSession>(authSession),
  requireUser: () => Effect.succeed(authSession),
  requireOrganization: () => Effect.succeed(authSession),
  requireUserOrganization: () => Effect.succeed(authSession),
};

const organizationImpersonationAuthClient = {
  getSession: () =>
    Effect.succeed<AuthSession>(organizationImpersonationSession),
  requireSession: () =>
    Effect.succeed<AuthSession>(organizationImpersonationSession),
  requireUser: () => Effect.succeed(organizationImpersonationSession),
  requireOrganization: () => Effect.succeed(organizationImpersonationSession),
  requireUserOrganization: () =>
    Effect.succeed(organizationImpersonationSession),
};

const rejectedAuthClient = {
  getSession: () => Effect.succeed<AuthSession | null>(null),
  requireSession: () => Effect.fail(new HttpApiError.Unauthorized({})),
  requireUser: () => Effect.fail(new HttpApiError.Unauthorized({})),
  requireOrganization: () => Effect.fail(new HttpApiError.Unauthorized({})),
  requireUserOrganization: () => Effect.fail(new HttpApiError.Unauthorized({})),
};

const unavailableAuthClient = {
  ...rejectedAuthClient,
  getSession: () => Effect.fail(new HttpApiError.ServiceUnavailable({})),
};

const userApiKeySession = {
  session: {
    id: "api-key:user-key-1",
    token: "user-key-1",
    userId: "user-1",
    activeOrganizationId: "org-1",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 3600000),
  },
  user,
  isSuperAdminImpersonation: false,
  authMethod: { type: "apiKey", apiKey: userApiKey },
} satisfies AuthSession;

const organizationApiKeySession = {
  session: {
    id: "api-key:org-key-1",
    token: "org-key-1",
    userId: "api-key:org-key-1",
    activeOrganizationId: "org-1",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 3600000),
  },
  user: undefined,
  isSuperAdminImpersonation: false,
  authMethod: { type: "apiKey", apiKey: organizationApiKey },
} satisfies AuthSession;

const userApiKeyAuthClient = {
  getSession: () => Effect.succeed<AuthSession>(userApiKeySession),
  requireSession: () => Effect.succeed<AuthSession>(userApiKeySession),
  requireUser: () => Effect.succeed(userApiKeySession),
  requireOrganization: () => Effect.succeed(userApiKeySession),
  requireUserOrganization: () => Effect.succeed(userApiKeySession),
};

const organizationApiKeyAuthClient = {
  getSession: () => Effect.succeed<AuthSession>(organizationApiKeySession),
  requireSession: () => Effect.succeed<AuthSession>(organizationApiKeySession),
  requireUser: () => Effect.fail(new HttpApiError.Unauthorized({})),
  requireOrganization: () => Effect.succeed(organizationApiKeySession),
  requireUserOrganization: () => Effect.fail(new HttpApiError.Unauthorized({})),
};

const baseAuthServiceLayer = AuthService.layer({
  baseUrl: "http://localhost",
  apiKey: Redacted.make("test-service-key"),
});
const authClientLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    ...authClient,
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const organizationImpersonationAuthClientLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    ...organizationImpersonationAuthClient,
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const rejectedAuthClientLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    ...rejectedAuthClient,
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const unavailableAuthClientLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    ...unavailableAuthClient,
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const userApiKeyAuthClientLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    ...userApiKeyAuthClient,
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const organizationApiKeyAuthClientLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    ...organizationApiKeyAuthClient,
  })),
).pipe(Layer.provide(baseAuthServiceLayer));

const requiredOrganizationLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    getSession: () => Effect.succeed(authSession),
    requireOrganization: () => Effect.succeed(authSession),
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const missingOrganizationLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    getSession: () =>
      Effect.succeed({
        ...authSession,
        session: { ...authSession.session, activeOrganizationId: null },
      }),
    requireOrganization: () => Effect.fail(new HttpApiError.Unauthorized({})),
  })),
).pipe(Layer.provide(baseAuthServiceLayer));
const missingSessionLayer = Layer.effect(
  AuthService,
  Effect.map(AuthService, (service) => ({
    ...service,
    getSession: () => Effect.succeed(null),
    requireSession: () => Effect.fail(new HttpApiError.Unauthorized({})),
  })),
).pipe(Layer.provide(baseAuthServiceLayer));

describe("SessionContext", () => {
  it.effect("can require an active organization", () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const session = yield* auth.requireOrganization();

      expect(session.session.activeOrganizationId).toBe("org-1");
    }).pipe(Effect.provide(requiredOrganizationLayer)),
  );

  it.effect("rejects a missing required active organization", () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const error = yield* auth.requireOrganization().pipe(Effect.flip);

      expect(error).toBeInstanceOf(HttpApiError.Unauthorized);
    }).pipe(Effect.provide(missingOrganizationLayer)),
  );

  it.effect("rejects missing auth when a session is required", () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const error = yield* auth.requireSession().pipe(Effect.flip);

      expect(error).toBeInstanceOf(HttpApiError.Unauthorized);
    }).pipe(Effect.provide(missingSessionLayer)),
  );
});

describe("AuthenticationLive", () => {
  it.effect("provides cookie session-derived auth contexts", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;

        const response = yield* middleware.apiKey(
          Effect.gen(function* () {
            const auth = yield* AuthService;
            const session = yield* auth.getSession().pipe(Effect.orDie);

            expect(session).not.toBeNull();
            if (!session) return HttpServerResponse.text("missing session");
            expect(session.session.id).toBe("session-1");
            expect(session.authMethod.type).toBe("cookie");
            return HttpServerResponse.text("ok");
          }),
          { ...middlewareOptions, credential: Redacted.make("") },
        );

        expect(response.status).toBe(200);
      }),
    ).pipe(Effect.provide(makeAuthenticationLive(authClientLayer))),
  );

  it.effect("provides anonymous context for missing cookie sessions", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;
        const response = yield* middleware.apiKey(
          Effect.gen(function* () {
            const auth = yield* AuthService;
            const session = yield* auth.getSession().pipe(Effect.orDie);

            expect(session).toBeNull();

            return HttpServerResponse.text("ok");
          }),
          {
            ...middlewareOptions,
            credential: Redacted.make(""),
          },
        );

        expect(response.status).toBe(200);
      }),
    ).pipe(Effect.provide(makeAuthenticationLive(rejectedAuthClientLayer))),
  );

  it.effect(
    "maps auth client initialization failures to ServiceUnavailable",
    () =>
      provideRequestContext(
        Effect.gen(function* () {
          const middleware = yield* AuthMiddleware;
          const error = yield* middleware
            .apiKey(Effect.succeed(HttpServerResponse.text("ok")), {
              ...middlewareOptions,
              credential: Redacted.make(""),
            })
            .pipe(Effect.flip);

          expect(error).toBeInstanceOf(HttpApiError.ServiceUnavailable);
        }),
      ).pipe(
        Effect.provide(
          makeAuthenticationLive(
            Layer.effect(AuthService, Effect.fail("auth unavailable")),
          ),
        ),
      ),
  );

  it.effect("preserves session upstream ServiceUnavailable failures", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;
        const error = yield* middleware
          .apiKey(Effect.succeed(HttpServerResponse.text("ok")), {
            ...middlewareOptions,
            credential: Redacted.make(""),
          })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(HttpApiError.ServiceUnavailable);
      }),
    ).pipe(Effect.provide(makeAuthenticationLive(unavailableAuthClientLayer))),
  );

  it.effect("authenticates user API keys", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;

        const response = yield* middleware.apiKey(
          Effect.gen(function* () {
            const auth = yield* AuthService;
            const session = yield* auth.getSession().pipe(Effect.orDie);

            expect(session).not.toBeNull();
            if (!session) return HttpServerResponse.text("missing session");
            expect(session.session.id).toBe("api-key:user-key-1");
            expect(session.session.userId).toBe("user-1");
            expect(session.session.activeOrganizationId).toBe("org-1");
            expect(session.authMethod.type).toBe("apiKey");
            expect(
              session.authMethod.type === "apiKey"
                ? session.authMethod.apiKey.id
                : null,
            ).toBe("user-key-1");
            return HttpServerResponse.text("ok");
          }),
          { ...middlewareOptions, credential: Redacted.make("user_secret") },
        );

        expect(response.status).toBe(200);
      }),
    ).pipe(Effect.provide(makeAuthenticationLive(userApiKeyAuthClientLayer))),
  );

  it.effect("authenticates organization API keys", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;

        const response = yield* middleware.apiKey(
          Effect.gen(function* () {
            const auth = yield* AuthService;
            const session = yield* auth.getSession().pipe(Effect.orDie);

            expect(session).not.toBeNull();
            if (!session) return HttpServerResponse.text("missing session");
            expect(session.session.id).toBe("api-key:org-key-1");
            expect(session.session.userId).toBe("api-key:org-key-1");
            expect(session.session.activeOrganizationId).toBe("org-1");
            expect(session.user).toBeUndefined();
            expect(session.authMethod.type).toBe("apiKey");
            expect(
              session.authMethod.type === "apiKey"
                ? session.authMethod.apiKey.id
                : null,
            ).toBe("org-key-1");
            return HttpServerResponse.text("ok");
          }),
          { ...middlewareOptions, credential: Redacted.make("org_secret") },
        );

        expect(response.status).toBe(200);
      }),
    ).pipe(
      Effect.provide(
        makeAuthenticationLive({
          authLayer: organizationApiKeyAuthClientLayer,
          apiKeyConfigId: "organization",
        }),
      ),
    ),
  );

  it.effect("blocks organization impersonation by default", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;
        const error = yield* middleware
          .apiKey(Effect.succeed(HttpServerResponse.text("ok")), {
            ...middlewareOptions,
            credential: Redacted.make(""),
          })
          .pipe(Effect.flip);

        expect(error).toBeInstanceOf(HttpApiError.Forbidden);
      }),
    ).pipe(
      Effect.provide(
        AuthMiddleware.layer({
          authLayer: organizationImpersonationAuthClientLayer,
        }),
      ),
    ),
  );

  it.effect("allows organization impersonation on explicit paths", () =>
    provideRequestContext(
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;
        const response = yield* middleware.apiKey(
          Effect.succeed(HttpServerResponse.text("ok")),
          {
            ...middlewareOptions,
            credential: Redacted.make(""),
          },
        );

        expect(response.status).toBe(200);
      }),
    ).pipe(
      Effect.provide(
        AuthMiddleware.layer({
          allowedOrganizationImpersonationRoutes: [
            { method: "GET", path: "/test" },
          ],
          authLayer: organizationImpersonationAuthClientLayer,
        }),
      ),
    ),
  );

  it.effect("allows organization impersonation on explicit dynamic paths", () =>
    provideRequestContextWith(
      dynamicRequest,
      Effect.gen(function* () {
        const middleware = yield* AuthMiddleware;
        const response = yield* middleware.apiKey(
          Effect.succeed(HttpServerResponse.text("ok")),
          {
            ...middlewareOptions,
            credential: Redacted.make(""),
          },
        );

        expect(response.status).toBe(200);
      }),
    ).pipe(
      Effect.provide(
        AuthMiddleware.layer({
          allowedOrganizationImpersonationRoutes: [
            { method: "GET", path: "/api/learner/collections/:id/courses" },
          ],
          authLayer: organizationImpersonationAuthClientLayer,
        }),
      ),
    ),
  );

  it.effect(
    "blocks organization impersonation when only the path matches",
    () =>
      provideRequestContextWith(
        postRequest,
        Effect.gen(function* () {
          const middleware = yield* AuthMiddleware;
          const error = yield* middleware
            .apiKey(Effect.succeed(HttpServerResponse.text("ok")), {
              ...middlewareOptions,
              credential: Redacted.make(""),
            })
            .pipe(Effect.flip);

          expect(error).toBeInstanceOf(HttpApiError.Forbidden);
        }),
      ).pipe(
        Effect.provide(
          AuthMiddleware.layer({
            allowedOrganizationImpersonationRoutes: [
              { method: "GET", path: "/test" },
            ],
            authLayer: organizationImpersonationAuthClientLayer,
          }),
        ),
      ),
  );

  it.effect(
    "blocks organization impersonation on dynamic paths when only the path matches",
    () =>
      provideRequestContextWith(
        dynamicPostRequest,
        Effect.gen(function* () {
          const middleware = yield* AuthMiddleware;
          const error = yield* middleware
            .apiKey(Effect.succeed(HttpServerResponse.text("ok")), {
              ...middlewareOptions,
              credential: Redacted.make(""),
            })
            .pipe(Effect.flip);

          expect(error).toBeInstanceOf(HttpApiError.Forbidden);
        }),
      ).pipe(
        Effect.provide(
          AuthMiddleware.layer({
            allowedOrganizationImpersonationRoutes: [
              { method: "GET", path: "/api/learner/collections/:id/courses" },
            ],
            authLayer: organizationImpersonationAuthClientLayer,
          }),
        ),
      ),
  );
});
