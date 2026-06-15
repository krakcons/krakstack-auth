import { Effect } from "effect";
import { count } from "drizzle-orm";
import type { Headers } from "effect/unstable/http/Headers";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi } from "@/api";
import { oauthClient, oauthConsent, user } from "@/db/auth-schema";
import { auth } from "@/services/auth/config";
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

const requireAdmin = (headers: Headers) =>
  Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
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
          yield* requireAdmin(request.headers);

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

          const totalUsers = Number(userTotals[0]?.count ?? 0);
          const consentMap = new Map(
            consentCounts.map((c) => [c.clientId, Number(c.userCount)]),
          );

          const clientStats = clients.map((client) => ({
            ...client,
            userCount: consentMap.get(client.clientId) ?? 0,
          }));

          return {
            totalUsers,
            totalClients: clients.length,
            clients: clientStats,
          };
        }),
      )
      .handle("listOrganizations", ({ request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          return yield* service
            .list({ headers: request.headers })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("createOrganization", ({ payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          return yield* service
            .create({ headers: request.headers, payload })
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("updateOrganization", ({ params, payload, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          const organization = yield* service
            .update({ headers: request.headers, id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("deleteOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          yield* requireAdmin(request.headers);

          const service = yield* Organizations;
          const organization = yield* service
            .delete({ headers: request.headers, id: params.id })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      ),
);
