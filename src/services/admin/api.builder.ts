import { Effect } from "effect";
import { and, count, countDistinct, gt, gte } from "drizzle-orm";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { AdminApi } from "@/api";
import {
  apikey,
  domains,
  oauthClient,
  organization,
  project,
  session,
  user,
} from "@/db/auth-schema";
import { Domains } from "@/services/domains";
import { db } from "@/services/database";
import { Organizations } from "@/services/organizations";

const internalServerError = (error: unknown) => {
  console.error("Failed to fetch dashboard stats:", error);
  return new HttpApiError.InternalServerError({});
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const daysAgo = (days: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};

const chartRangeDays = (days: "7" | "14" | "30" | "90" | undefined) =>
  days ? Number(days) : 14;

export const adminApiHandler = HttpApiBuilder.group(
  AdminApi,
  "admin",
  (handlers) =>
    handlers
      .handle("dashboardStats", ({ query }) =>
        Effect.gen(function* () {
          const userTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(user),
            catch: internalServerError,
          });

          const organizationTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(organization),
            catch: internalServerError,
          });

          const projectTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(project),
            catch: internalServerError,
          });

          const domainTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(domains),
            catch: internalServerError,
          });

          const apiKeyTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(apikey),
            catch: internalServerError,
          });

          const oauthClientTotals = yield* Effect.tryPromise({
            try: () => db.select({ count: count() }).from(oauthClient),
            catch: internalServerError,
          });

          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const chartDays = chartRangeDays(query.days);
          const chartStart = daysAgo(chartDays - 1);
          const activeUserTotals = yield* Effect.tryPromise({
            try: () =>
              db
                .select({ count: countDistinct(session.userId) })
                .from(session)
                .where(
                  and(
                    gte(session.updatedAt, since),
                    gt(session.expiresAt, new Date()),
                  ),
                ),
            catch: internalServerError,
          });

          const recentSessions = yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  userId: session.userId,
                  updatedAt: session.updatedAt,
                })
                .from(session)
                .where(
                  and(
                    gte(session.updatedAt, chartStart),
                    gt(session.expiresAt, new Date()),
                  ),
                ),
            catch: internalServerError,
          });

          const recentUsers = yield* Effect.tryPromise({
            try: () =>
              db
                .select({ createdAt: user.createdAt })
                .from(user)
                .where(gte(user.createdAt, chartStart)),
            catch: internalServerError,
          });

          const totalUsers = Number(userTotals[0]?.count ?? 0);
          const totalOrganizations = Number(organizationTotals[0]?.count ?? 0);
          const totalProjects = Number(projectTotals[0]?.count ?? 0);
          const totalDomains = Number(domainTotals[0]?.count ?? 0);
          const totalApiKeys = Number(apiKeyTotals[0]?.count ?? 0);
          const totalOauthClients = Number(oauthClientTotals[0]?.count ?? 0);
          const dailyActiveUsers = Number(activeUserTotals[0]?.count ?? 0);
          const activeUsersByDay = new Map<string, Set<string>>();

          for (const item of recentSessions) {
            const key = dayKey(item.updatedAt);
            const users = activeUsersByDay.get(key) ?? new Set<string>();
            users.add(item.userId);
            activeUsersByDay.set(key, users);
          }

          const dailyActiveUsersByDay = Array.from(
            { length: chartDays },
            (_, index) => {
              const date = daysAgo(chartDays - 1 - index);
              const key = dayKey(date);
              return {
                date: key,
                count: activeUsersByDay.get(key)?.size ?? 0,
              };
            },
          );

          const signupsByDate = new Map<string, number>();

          for (const item of recentUsers) {
            const key = dayKey(item.createdAt);
            signupsByDate.set(key, (signupsByDate.get(key) ?? 0) + 1);
          }

          const signupsByDay = Array.from({ length: chartDays }, (_, index) => {
            const date = daysAgo(chartDays - 1 - index);
            const key = dayKey(date);
            return {
              date: key,
              count: signupsByDate.get(key) ?? 0,
            };
          });

          return {
            totalUsers,
            totalOrganizations,
            totalProjects,
            totalDomains,
            totalApiKeys,
            totalOauthClients,
            dailyActiveUsers,
            dailyActiveUsersByDay,
            signupsByDay,
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
