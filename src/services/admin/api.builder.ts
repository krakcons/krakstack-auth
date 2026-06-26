import { Effect } from "effect";
import { count } from "drizzle-orm";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi } from "@/api";
import { oauthClient, oauthConsent, project, user } from "@/db/auth-schema";
import { Domains } from "@/services/domains";
import { db } from "@/services/database";
import { Organizations } from "@/services/organizations";

const internalServerError = (error: unknown) => {
  console.error("Failed to fetch OAuth stats:", error);
  return new HttpApiError.InternalServerError({});
};

export const adminApiHandler = HttpApiBuilder.group(
  AdminApi,
  "admin",
  (handlers) =>
    handlers
      .handle("oauthStats", () =>
        Effect.gen(function* () {
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
          const service = yield* Organizations;
          return yield* service
            .list({ request })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createOrganization", ({ payload, request }) =>
        Effect.gen(function* () {
          const service = yield* Organizations;
          return yield* service
            .create({ request, payload })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("updateOrganization", ({ params, payload, request }) =>
        Effect.gen(function* () {
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
          const service = yield* Organizations;
          const organization = yield* service
            .delete({ request, id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("listDomains", () =>
        Effect.gen(function* () {
          const service = yield* Domains;
          return yield* service
            .list()
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createDomain", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* Domains;
          const domain = yield* service
            .create({ payload })
            .pipe(Effect.mapError(internalServerError));

          if (!domain) return yield* new HttpApiError.BadRequest({});
          return domain;
        }),
      )
      .handle("updateDomain", ({ params, payload }) =>
        Effect.gen(function* () {
          const service = yield* Domains;
          const domain = yield* service
            .update({ id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!domain) return yield* new HttpApiError.NotFound({});
          return domain;
        }),
      )
      .handle("getDomainRecords", ({ params }) =>
        Effect.gen(function* () {
          const service = yield* Domains;
          const records = yield* service
            .records({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!records) return yield* new HttpApiError.NotFound({});
          return records;
        }),
      )
      .handle("deleteDomain", ({ params }) =>
        Effect.gen(function* () {
          const service = yield* Domains;
          const domain = yield* service
            .delete({ id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!domain) return yield* new HttpApiError.NotFound({});
          return domain;
        }),
      ),
);
