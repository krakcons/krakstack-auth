import { Effect, Schema } from "effect";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  max,
  or,
} from "drizzle-orm";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import {
  SortParamsFromString,
  type AdminListQuery,
} from "@krak-stack/auth/admin";

import { AdminApi } from "@/api";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import {
  apiKeyAllowedOrigins,
  encodeApiKeyAllowedOrigins,
} from "@/services/auth/api-key-referrers";
import {
  apikey,
  domains,
  oauthClient,
  organization,
  member,
  project,
  projectOrganization,
  projectUser,
  session,
  user,
} from "@/db/schema";
import { Domains } from "@/services/domains";
import { DB } from "@/services/database";
import { Organizations } from "@/services/organizations";

const internalServerError = (cause: unknown) => {
  console.error("Failed to fetch dashboard stats:", cause);
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

const paginationMeta = ({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) => ({
  page,
  pageSize,
  total,
  pageCount: Math.ceil(total / pageSize),
});

const previewsByResource = (
  records: ReadonlyArray<{
    resourceId: string;
    id: string;
    name: string;
    logo: string | null;
  }>,
) => {
  const projectsByResource = new Map<
    string,
    Array<{ id: string; name: string; logo: string | null }>
  >();
  for (const { resourceId, id, name, logo } of records) {
    projectsByResource.set(resourceId, [
      ...(projectsByResource.get(resourceId) ?? []),
      { id, name, logo },
    ]);
  }
  return projectsByResource;
};

const userOrderBy = (query: AdminListQuery) => {
  const sort = query.sort
    ? Schema.decodeSync(SortParamsFromString)(query.sort)
    : [];

  return sort.flatMap((sortParam) => {
    const direction = sortParam.direction === "desc" ? desc : asc;

    switch (sortParam.id) {
      case "name":
        return [direction(user.name)];
      case "email":
        return [direction(user.email)];
      case "emailVerified":
        return [direction(user.emailVerified)];
      case "role":
        return [direction(user.role)];
      case "banned":
        return [direction(user.banned)];
      case "lastSignedIn":
        return [direction(max(session.createdAt))];
      case "createdAt":
        return [direction(user.createdAt)];
      default:
        return [];
    }
  });
};

const organizationOrderBy = (query: AdminListQuery) => {
  const sort = query.sort
    ? Schema.decodeSync(SortParamsFromString)(query.sort)
    : [];

  return sort.flatMap((sortParam) => {
    const direction = sortParam.direction === "desc" ? desc : asc;

    switch (sortParam.id) {
      case "name":
        return [direction(organization.name)];
      case "slug":
        return [direction(organization.slug)];
      case "createdAt":
        return [direction(organization.createdAt)];
      default:
        return [];
    }
  });
};

const userFilter = (globalFilter: string | undefined) => {
  const filter = globalFilter?.trim();
  if (!filter) return undefined;
  const pattern = `%${filter}%`;

  return or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(user.role, pattern),
  );
};

const organizationFilter = (globalFilter: string | undefined) => {
  const filter = globalFilter?.trim();
  if (!filter) return undefined;
  const pattern = `%${filter}%`;

  return or(
    ilike(organization.name, pattern),
    ilike(organization.slug, pattern),
    ilike(organization.logo, pattern),
  );
};

const serviceApiKeyRow = (value: typeof apikey.$inferSelect) => ({
  id: value.id,
  configId: value.configId,
  name: value.name,
  start: value.start,
  referenceId: value.referenceId,
  prefix: value.prefix,
  enabled: value.enabled ?? false,
  rateLimitEnabled: value.rateLimitEnabled ?? false,
  rateLimitTimeWindow: value.rateLimitTimeWindow,
  rateLimitMax: value.rateLimitMax,
  requestCount: value.requestCount ?? 0,
  remaining: value.remaining,
  lastRequest: value.lastRequest,
  expiresAt: value.expiresAt,
  referrers: apiKeyAllowedOrigins(value.metadata),
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

export const adminApiHandler = HttpApiBuilder.group(
  AdminApi,
  "admin",
  (handlers) =>
    handlers
      .handle("dashboardStats", ({ query }) =>
        Effect.gen(function* () {
          const db = yield* DB;

          const userTotals = yield* db
            .select({ count: count() })
            .from(user)
            .pipe(Effect.mapError(internalServerError));

          const organizationTotals = yield* db
            .select({ count: count() })
            .from(organization)
            .pipe(Effect.mapError(internalServerError));

          const projectTotals = yield* db
            .select({ count: count() })
            .from(project)
            .pipe(Effect.mapError(internalServerError));

          const domainTotals = yield* db
            .select({ count: count() })
            .from(domains)
            .pipe(Effect.mapError(internalServerError));

          const apiKeyTotals = yield* db
            .select({ count: count() })
            .from(apikey)
            .pipe(Effect.mapError(internalServerError));

          const oauthClientTotals = yield* db
            .select({ count: count() })
            .from(oauthClient)
            .pipe(Effect.mapError(internalServerError));

          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const chartDays = chartRangeDays(query.days);
          const chartStart = daysAgo(chartDays - 1);
          const activeUserTotals = yield* db
            .select({ count: countDistinct(session.userId) })
            .from(session)
            .where(
              and(
                gte(session.updatedAt, since),
                gt(session.expiresAt, new Date()),
              ),
            )
            .pipe(Effect.mapError(internalServerError));

          const recentSessions = yield* db
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
            )
            .pipe(Effect.mapError(internalServerError));

          const recentUsers = yield* db
            .select({ createdAt: user.createdAt })
            .from(user)
            .where(gte(user.createdAt, chartStart))
            .pipe(Effect.mapError(internalServerError));

          const projectConnections = yield* db
            .select({
              projectId: project.id,
              projectName: project.name,
              users: countDistinct(projectUser.userId),
              organizations: countDistinct(projectOrganization.organizationId),
            })
            .from(project)
            .leftJoin(projectUser, eq(projectUser.projectId, project.id))
            .leftJoin(
              projectOrganization,
              eq(projectOrganization.projectId, project.id),
            )
            .groupBy(project.id, project.name)
            .orderBy(asc(project.name))
            .pipe(Effect.mapError(internalServerError));

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
            projectConnections: projectConnections.map((item) => ({
              projectId: item.projectId,
              projectName: item.projectName,
              users: Number(item.users),
              organizations: Number(item.organizations),
            })),
          };
        }),
      )
      .handle("listApiKeys", () =>
        Effect.gen(function* () {
          const db = yield* DB;
          const keys = yield* db
            .select()
            .from(apikey)
            .orderBy(desc(apikey.createdAt))
            .pipe(Effect.mapError(internalServerError));

          return keys.map(serviceApiKeyRow);
        }),
      )
      .handle("deleteApiKey", ({ params }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const [key] = yield* db
            .delete(apikey)
            .where(eq(apikey.id, params.id))
            .returning()
            .pipe(Effect.mapError(internalServerError));

          if (!key) return yield* new HttpApiError.NotFound({});
          return serviceApiKeyRow(key);
        }),
      )
      .handle("updateApiKey", ({ params, payload }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const name = payload.name?.trim() || null;
          const existing =
            payload.referrers === undefined
              ? undefined
              : yield* db.query.apikey
                  .findFirst({
                    columns: { metadata: true },
                    where: { id: params.id },
                  })
                  .pipe(Effect.mapError(internalServerError));
          if (payload.referrers !== undefined && !existing) {
            return yield* new HttpApiError.NotFound({});
          }
          const updates: Partial<typeof apikey.$inferInsert> = {
            updatedAt: new Date(),
          };
          if (payload.name !== undefined) updates.name = name;
          if (payload.enabled !== undefined) updates.enabled = payload.enabled;
          if (payload.rateLimitEnabled !== undefined)
            updates.rateLimitEnabled = payload.rateLimitEnabled;
          if (payload.rateLimitMax !== undefined)
            updates.rateLimitMax = payload.rateLimitMax;
          if (payload.rateLimitTimeWindow !== undefined)
            updates.rateLimitTimeWindow = payload.rateLimitTimeWindow;
          if (payload.referrers !== undefined) {
            updates.metadata = encodeApiKeyAllowedOrigins(
              existing?.metadata,
              payload.referrers,
            );
          }

          const [key] = yield* db
            .update(apikey)
            .set(updates)
            .where(eq(apikey.id, params.id))
            .returning()
            .pipe(Effect.mapError(internalServerError));

          if (!key) return yield* new HttpApiError.NotFound({});
          return serviceApiKeyRow(key);
        }),
      )
      .handle("resetApiKeyRateLimit", ({ params }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const [key] = yield* db
            .update(apikey)
            .set({ requestCount: 0, lastRequest: null, updatedAt: new Date() })
            .where(eq(apikey.id, params.id))
            .returning()
            .pipe(Effect.mapError(internalServerError));

          if (!key) return yield* new HttpApiError.NotFound({});
          return serviceApiKeyRow(key);
        }),
      )
      .handle("enableApiKeyRateLimit", ({ params }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const [key] = yield* db
            .update(apikey)
            .set({ rateLimitEnabled: true, updatedAt: new Date() })
            .where(eq(apikey.id, params.id))
            .returning()
            .pipe(Effect.mapError(internalServerError));

          if (!key) return yield* new HttpApiError.NotFound({});
          return serviceApiKeyRow(key);
        }),
      )
      .handle("disableApiKeyRateLimit", ({ params }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const [key] = yield* db
            .update(apikey)
            .set({ rateLimitEnabled: false, updatedAt: new Date() })
            .where(eq(apikey.id, params.id))
            .returning()
            .pipe(Effect.mapError(internalServerError));

          if (!key) return yield* new HttpApiError.NotFound({});
          return serviceApiKeyRow(key);
        }),
      )
      .handle("listUsers", ({ query }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const where = userFilter(query.globalFilter);
          const projectWhere = query.projectId
            ? and(where, eq(projectUser.projectId, query.projectId))
            : where;
          const orderBy = userOrderBy(query);
          const fallbackOrderBy = [desc(user.createdAt)];
          const offset = query.page * query.pageSize;

          const totals = yield* (
            query.projectId
              ? db
                  .select({ count: count() })
                  .from(user)
                  .innerJoin(projectUser, eq(projectUser.userId, user.id))
                  .where(projectWhere)
              : db.select({ count: count() }).from(user).where(projectWhere)
          ).pipe(Effect.mapError(internalServerError));

          const users = yield* (
            query.projectId
              ? db
                  .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    image: user.image,
                    createdAt: user.createdAt,
                    lastSignedIn: max(session.createdAt),
                    role: user.role,
                    banned: user.banned,
                    banReason: user.banReason,
                    banExpires: user.banExpires,
                  })
                  .from(user)
                  .innerJoin(projectUser, eq(projectUser.userId, user.id))
                  .leftJoin(session, eq(session.userId, user.id))
                  .where(projectWhere)
                  .groupBy(
                    user.id,
                    user.name,
                    user.email,
                    user.emailVerified,
                    user.image,
                    user.createdAt,
                    user.role,
                    user.banned,
                    user.banReason,
                    user.banExpires,
                  )
                  .orderBy(...(orderBy.length ? orderBy : fallbackOrderBy))
                  .limit(query.pageSize)
                  .offset(offset)
              : db
                  .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    image: user.image,
                    createdAt: user.createdAt,
                    lastSignedIn: max(session.createdAt),
                    role: user.role,
                    banned: user.banned,
                    banReason: user.banReason,
                    banExpires: user.banExpires,
                  })
                  .from(user)
                  .leftJoin(session, eq(session.userId, user.id))
                  .where(projectWhere)
                  .groupBy(
                    user.id,
                    user.name,
                    user.email,
                    user.emailVerified,
                    user.image,
                    user.createdAt,
                    user.role,
                    user.banned,
                    user.banReason,
                    user.banExpires,
                  )
                  .orderBy(...(orderBy.length ? orderBy : fallbackOrderBy))
                  .limit(query.pageSize)
                  .offset(offset)
          ).pipe(Effect.mapError(internalServerError));

          const userProjects = users.length
            ? yield* db
                .select({
                  resourceId: projectUser.userId,
                  id: project.id,
                  name: project.name,
                  logo: project.logo,
                })
                .from(projectUser)
                .innerJoin(project, eq(project.id, projectUser.projectId))
                .where(
                  inArray(
                    projectUser.userId,
                    users.map(({ id }) => id),
                  ),
                )
                .pipe(Effect.mapError(internalServerError))
            : [];
          const projectsByUser = previewsByResource(userProjects);
          const userOrganizations = users.length
            ? yield* db
                .select({
                  resourceId: member.userId,
                  id: organization.id,
                  name: organization.name,
                  logo: organization.logo,
                })
                .from(member)
                .innerJoin(
                  organization,
                  eq(organization.id, member.organizationId),
                )
                .where(
                  inArray(
                    member.userId,
                    users.map(({ id }) => id),
                  ),
                )
                .pipe(Effect.mapError(internalServerError))
            : [];
          const organizationsByUser = previewsByResource(userOrganizations);

          const total = Number(totals[0]?.count ?? 0);

          return {
            data: users.map((user) => ({
              ...user,
              organizations: organizationsByUser.get(user.id) ?? [],
              projects: projectsByUser.get(user.id) ?? [],
            })),
            meta: paginationMeta({
              page: query.page,
              pageSize: query.pageSize,
              total,
            }),
          };
        }),
      )
      .handle("listOrganizations", ({ query }) =>
        Effect.gen(function* () {
          const db = yield* DB;
          const where = organizationFilter(query.globalFilter);
          const projectWhere = query.projectId
            ? and(where, eq(projectOrganization.projectId, query.projectId))
            : where;
          const orderBy = organizationOrderBy(query);
          const fallbackOrderBy = [desc(organization.createdAt)];
          const offset = query.page * query.pageSize;

          const totals = yield* (
            query.projectId
              ? db
                  .select({ count: count() })
                  .from(organization)
                  .innerJoin(
                    projectOrganization,
                    eq(projectOrganization.organizationId, organization.id),
                  )
                  .where(projectWhere)
              : db
                  .select({ count: count() })
                  .from(organization)
                  .where(projectWhere)
          ).pipe(Effect.mapError(internalServerError));

          const organizations = yield* (
            query.projectId
              ? db
                  .select({
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug,
                    logo: organization.logo,
                    metadata: organization.metadata,
                    userId: organization.userId,
                    parentId: organization.parentId,
                    memberCount: count(member.id),
                    createdAt: organization.createdAt,
                  })
                  .from(organization)
                  .innerJoin(
                    projectOrganization,
                    eq(projectOrganization.organizationId, organization.id),
                  )
                  .leftJoin(member, eq(member.organizationId, organization.id))
                  .where(projectWhere)
                  .groupBy(
                    organization.id,
                    organization.name,
                    organization.slug,
                    organization.logo,
                    organization.metadata,
                    organization.userId,
                    organization.parentId,
                    organization.createdAt,
                  )
                  .orderBy(...(orderBy.length ? orderBy : fallbackOrderBy))
                  .limit(query.pageSize)
                  .offset(offset)
              : db
                  .select({
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug,
                    logo: organization.logo,
                    metadata: organization.metadata,
                    userId: organization.userId,
                    parentId: organization.parentId,
                    memberCount: count(member.id),
                    createdAt: organization.createdAt,
                  })
                  .from(organization)
                  .leftJoin(member, eq(member.organizationId, organization.id))
                  .where(projectWhere)
                  .groupBy(
                    organization.id,
                    organization.name,
                    organization.slug,
                    organization.logo,
                    organization.metadata,
                    organization.userId,
                    organization.parentId,
                    organization.createdAt,
                  )
                  .orderBy(...(orderBy.length ? orderBy : fallbackOrderBy))
                  .limit(query.pageSize)
                  .offset(offset)
          ).pipe(Effect.mapError(internalServerError));

          const organizationMembers = organizations.length
            ? yield* db
                .select({
                  organizationId: member.organizationId,
                  id: user.id,
                  name: user.name,
                  image: user.image,
                })
                .from(member)
                .innerJoin(user, eq(user.id, member.userId))
                .where(
                  inArray(
                    member.organizationId,
                    organizations.map(({ id }) => id),
                  ),
                )
                .pipe(Effect.mapError(internalServerError))
            : [];
          const organizationProjects = organizations.length
            ? yield* db
                .select({
                  resourceId: projectOrganization.organizationId,
                  id: project.id,
                  name: project.name,
                  logo: project.logo,
                })
                .from(projectOrganization)
                .innerJoin(
                  project,
                  eq(project.id, projectOrganization.projectId),
                )
                .where(
                  inArray(
                    projectOrganization.organizationId,
                    organizations.map(({ id }) => id),
                  ),
                )
                .pipe(Effect.mapError(internalServerError))
            : [];
          const projectsByOrganization =
            previewsByResource(organizationProjects);
          const membersByOrganization = new Map<
            string,
            typeof organizationMembers
          >();
          for (const organizationMember of organizationMembers) {
            const current =
              membersByOrganization.get(organizationMember.organizationId) ??
              [];
            membersByOrganization.set(organizationMember.organizationId, [
              ...current,
              organizationMember,
            ]);
          }

          const total = Number(totals[0]?.count ?? 0);

          return {
            data: organizations.map((organization) => ({
              ...organization,
              memberPreviews:
                membersByOrganization
                  .get(organization.id)
                  ?.map(({ id, name, image }) => ({ id, name, image })) ?? [],
              projects: projectsByOrganization.get(organization.id) ?? [],
            })),
            meta: paginationMeta({
              page: query.page,
              pageSize: query.pageSize,
              total,
            }),
          };
        }),
      )
      .handle("createOrganization", ({ payload, request }) =>
        Effect.gen(function* () {
          const service = yield* Organizations;
          return yield* service
            .create({ payload })
            .pipe(Effect.provide(BetterAuthRequest.make(request)))
            .pipe(Effect.mapError(internalServerError));
        }),
      )
      .handle("updateOrganization", ({ params, payload }) =>
        Effect.gen(function* () {
          const service = yield* Organizations;
          const organization = yield* service
            .update({ id: params.id, payload })
            .pipe(Effect.mapError(internalServerError));

          if (!organization) return yield* new HttpApiError.NotFound({});
          return organization;
        }),
      )
      .handle("deleteOrganization", ({ params, request }) =>
        Effect.gen(function* () {
          const service = yield* Organizations;
          const organization = yield* service
            .delete({ id: params.id })
            .pipe(Effect.provide(BetterAuthRequest.make(request)))
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
