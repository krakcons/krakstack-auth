import { Effect } from "effect";
import { count } from "drizzle-orm";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi } from "@/api";
import { oauthClient, oauthConsent, project, user } from "@/db/auth-schema";
import { authForRequest } from "@/services/auth/config";
import { Domains } from "@/services/domains";
import { db } from "@/services/database";
import { Organizations } from "@/services/organizations";

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
  console.error("Failed to fetch OAuth stats:", error);
  return new HttpApiError.InternalServerError({});
};

const requireAdmin = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
      Effect.mapError(internalServerError),
    );
    const session = yield* Effect.tryPromise({
      try: async () =>
        (await authForRequest(webRequest)).api.getSession({
          headers: webRequest.headers,
        }),
      catch: internalServerError,
    });

    if (!session) return yield* new HttpApiError.Unauthorized({});

    if (!hasAdminRole(userRole(session.user))) {
      return yield* new HttpApiError.Forbidden({});
    }
  });

export const adminApiHandler = HttpApiBuilder.group(
  AdminApi,
  "admin",
  (handlers) =>
    handlers
      .handle("oauthStats", ({ request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const clients = yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  id: oauthClient.id,
                  clientId: oauthClient.clientId,
                  name: oauthClient.name,
                  icon: oauthClient.icon,
                  disabled: oauthClient.disabled,
                })
                .from(oauthClient),
            catch: internalServerError,
          });

          const consentCounts = yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  clientId: oauthConsent.clientId,
                  userCount: count(oauthConsent.userId),
                })
                .from(oauthConsent)
                .groupBy(oauthConsent.clientId),
            catch: internalServerError,
          });

          const userTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(user),
            catch: internalServerError,
          });

          const projectTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(project),
            catch: internalServerError,
          });

          const totalUsers = Number(userTotals[0]?.count ?? 0);
          const totalProjects = Number(projectTotals[0]?.count ?? 0);
          const consentMap = new Map(
            consentCounts.map((c) => [c.clientId, Number(c.userCount)]),
          );

          const clientStats = clients.map((client) => ({
            ...client,
            userCount: consentMap.get(client.clientId) ?? 0,
          }));

          return {
            totalUsers,
            totalProjects,
            totalClients: clients.length,
            clients: clientStats,
          };
        }),
      )
      .handle("listOrganizations", ({ request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Organizations;
          return yield* service
            .list({ request })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createOrganization", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Organizations;
          return yield* service
            .create({ request, payload })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("updateOrganization", ({ params, payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Organizations;
          const organization = yield* service
            .update({ request, id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("deleteOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Organizations;
          const organization = yield* service
            .delete({ request, id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("listDomains", ({ request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Domains;
          return yield* service
            .list()
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createDomain", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Domains;
          const domain = yield* service
            .create({ payload })
            .pipe(Effect.mapError(internalServerError));

          if (!domain) return yield* new HttpApiError.BadRequest({});
          return domain;
        }),
      )
      .handle("updateDomain", ({ params, payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Domains;
          const domain = yield* service
            .update({ id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!domain) return yield* new HttpApiError.NotFound({});
          return domain;
        }),
      )
      .handle("getDomainRecords", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Domains;
          const records = yield* service
            .records({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!records) return yield* new HttpApiError.NotFound({});
          return records;
        }),
      )
      .handle("deleteDomain", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request);

          const service = yield* Domains;
          const domain = yield* service
            .delete({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!domain) return yield* new HttpApiError.NotFound({});
          return domain;
        }),
      ),
);
