import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { AdminListQuery, SortParamsFromString } from "@krak-stack/auth/admin";

import { AdminApi } from "@/api";
import { ApiKeyRow, ResourcePreviewRow } from "@/db/schema";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import {
  apiKeyAllowedOrigins,
  encodeApiKeyAllowedOrigins,
} from "@/services/auth/api-key-referrers";
import { Domains } from "@/services/domains";
import { Organizations } from "@/services/organizations";
import {
  AdminOrganizationRow,
  AdminUserRow,
  ApiKeyPermissionsJson,
  CountRow,
  DashboardTotalsRow,
  OrganizationMemberRow,
  ProjectConnectionRow,
  SessionActivityRow,
  SignupRow,
  type ApiKeySqlUpdate,
} from "./schema";

const internalServerError = (cause: unknown) => {
  console.error("Database request failed:", cause);
  return new HttpApiError.InternalServerError({});
};
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (days: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};
const paginationMeta = (query: typeof AdminListQuery.Type, total: number) => ({
  page: query.page,
  pageSize: query.pageSize,
  total,
  pageCount: Math.ceil(total / query.pageSize),
});
const previewsByResource = (
  records: ReadonlyArray<typeof ResourcePreviewRow.Type>,
) => {
  const previews = new Map<
    string,
    Array<{ id: string; name: string; logo: string | null }>
  >();
  for (const { resourceId, id, name, logo } of records) {
    previews.set(resourceId, [
      ...(previews.get(resourceId) ?? []),
      { id, name, logo },
    ]);
  }
  return previews;
};

// Only identifiers from this whitelist enter literal ORDER BY fragments.
const orderBy = (
  sql: SqlClient.SqlClient,
  query: typeof AdminListQuery.Type,
  kind: "user" | "organization",
) => {
  const columns: Readonly<Record<string, string>> =
    kind === "user"
      ? {
          name: "u.name",
          email: "u.email",
          emailVerified: "u.email_verified",
          role: "u.role",
          banned: "u.banned",
          lastSignedIn: "max(s.created_at)",
          createdAt: "u.created_at",
        }
      : {
          name: "o.name",
          slug: "o.slug",
          userId: "o.user_id",
          createdAt: "o.created_at",
        };
  const sorts = query.sort
    ? Schema.decodeSync(SortParamsFromString)(query.sort)
    : [];
  const clauses = sorts.flatMap(({ id, direction }) => {
    const column = columns[id];
    return column ? [`${column} ${direction === "desc" ? "DESC" : "ASC"}`] : [];
  });
  return sql.literal(
    clauses.length
      ? clauses.join(", ")
      : `${kind === "user" ? "u" : "o"}.created_at DESC`,
  );
};

const serviceApiKeyRow = (value: typeof ApiKeyRow.Type) =>
  Schema.decodeUnknownEffect(ApiKeyPermissionsJson)(
    value.permissions ?? "{}",
  ).pipe(
    Effect.mapError(internalServerError),
    Effect.map((permissions) => ({
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
      permissions: permissions ?? {},
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    })),
  );

export const adminApiHandler = HttpApiBuilder.group(
  AdminApi,
  "admin",
  (handlers) =>
    handlers
      .handle("dashboardStats", ({ query }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const chartDays = query.days ? Number(query.days) : 14;
          const chartStart = daysAgo(chartDays - 1);
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const totals = yield* SqlSchema.findOne({
            Request: Schema.Void,
            Result: DashboardTotalsRow,
            execute: () => sql`SELECT
        (SELECT count(*)::int FROM "user") AS total_users,
        (SELECT count(*)::int FROM organization) AS total_organizations,
        (SELECT count(*)::int FROM project) AS total_projects,
        (SELECT count(*)::int FROM domains) AS total_domains,
        (SELECT count(*)::int FROM apikey) AS total_api_keys,
        (SELECT count(*)::int FROM oauth_client) AS total_oauth_clients,
        (SELECT count(DISTINCT user_id)::int FROM session WHERE updated_at >= ${since} AND expires_at > ${new Date()}) AS daily_active_users`,
          })(undefined).pipe(Effect.mapError(internalServerError));
          const recentSessions = yield* SqlSchema.findAll({
            Request: Schema.Date,
            Result: SessionActivityRow,
            execute: (start) =>
              sql`SELECT user_id, updated_at FROM session WHERE updated_at >= ${start} AND expires_at > ${new Date()}`,
          })(chartStart).pipe(Effect.mapError(internalServerError));
          const recentUsers = yield* SqlSchema.findAll({
            Request: Schema.Date,
            Result: SignupRow,
            execute: (start) =>
              sql`SELECT created_at FROM "user" WHERE created_at >= ${start}`,
          })(chartStart).pipe(Effect.mapError(internalServerError));
          const projectConnections = yield* SqlSchema.findAll({
            Request: Schema.Void,
            Result: ProjectConnectionRow,
            execute:
              () => sql`SELECT p.id AS project_id, p.name AS project_name,
        count(DISTINCT pu.user_id)::int AS users, count(DISTINCT po.organization_id)::int AS organizations
        FROM project p LEFT JOIN project_user pu ON pu.project_id = p.id
        LEFT JOIN project_organization po ON po.project_id = p.id GROUP BY p.id ORDER BY p.name`,
          })(undefined).pipe(Effect.mapError(internalServerError));
          const activeUsers = new Map<string, Set<string>>();
          for (const item of recentSessions) {
            const key = dayKey(item.updatedAt);
            const users = activeUsers.get(key) ?? new Set<string>();
            users.add(item.userId);
            activeUsers.set(key, users);
          }
          const signups = new Map<string, number>();
          for (const item of recentUsers) {
            const key = dayKey(item.createdAt);
            signups.set(key, (signups.get(key) ?? 0) + 1);
          }
          return {
            ...totals,
            projectConnections,
            dailyActiveUsersByDay: Array.from(
              { length: chartDays },
              (_, index) => {
                const date = dayKey(daysAgo(chartDays - 1 - index));
                return { date, count: activeUsers.get(date)?.size ?? 0 };
              },
            ),
            signupsByDay: Array.from({ length: chartDays }, (_, index) => {
              const date = dayKey(daysAgo(chartDays - 1 - index));
              return { date, count: signups.get(date) ?? 0 };
            }),
          };
        }),
      )
      .handle("listApiKeys", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const keys = yield* SqlSchema.findAll({
            Request: Schema.Void,
            Result: ApiKeyRow,
            execute: () => sql`SELECT * FROM apikey ORDER BY created_at DESC`,
          })(undefined).pipe(Effect.mapError(internalServerError));
          return yield* Effect.forEach(keys, serviceApiKeyRow);
        }),
      )
      .handle("deleteApiKey", ({ params }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const key = yield* SqlSchema.findOneOption({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) =>
              sql`DELETE FROM apikey WHERE id = ${id} RETURNING *`,
          })(params.id).pipe(Effect.mapError(internalServerError));
          if (key._tag === "None") return yield* new HttpApiError.NotFound({});
          return yield* serviceApiKeyRow(key.value);
        }),
      )
      .handle("updateApiKey", ({ params, payload }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const existing = yield* SqlSchema.findOneOption({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) => sql`SELECT * FROM apikey WHERE id = ${id} LIMIT 1`,
          })(params.id).pipe(Effect.mapError(internalServerError));
          if (existing._tag === "None")
            return yield* new HttpApiError.NotFound({});
          const updates: ApiKeySqlUpdate = {
            updatedAt: new Date(),
          };
          if (payload.name !== undefined)
            updates.name = payload.name?.trim() || null;
          if (payload.enabled !== undefined) updates.enabled = payload.enabled;
          if (payload.rateLimitEnabled !== undefined)
            updates.rateLimitEnabled = payload.rateLimitEnabled;
          if (payload.rateLimitMax !== undefined)
            updates.rateLimitMax = payload.rateLimitMax;
          if (payload.rateLimitTimeWindow !== undefined)
            updates.rateLimitTimeWindow = payload.rateLimitTimeWindow;
          if (payload.referrers !== undefined)
            updates.metadata = encodeApiKeyAllowedOrigins(
              existing.value.metadata,
              payload.referrers,
            );
          const key = yield* SqlSchema.findOneOption({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) =>
              sql`UPDATE apikey SET ${sql.update(updates)} WHERE id = ${id} RETURNING *`,
          })(params.id).pipe(Effect.mapError(internalServerError));
          if (key._tag === "None") return yield* new HttpApiError.NotFound({});
          return yield* serviceApiKeyRow(key.value);
        }),
      )
      .handle("resetApiKeyRateLimit", ({ params }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const key = yield* SqlSchema.findOneOption({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) =>
              sql`UPDATE apikey SET request_count = 0, last_request = NULL, updated_at = ${new Date()} WHERE id = ${id} RETURNING *`,
          })(params.id).pipe(Effect.mapError(internalServerError));
          if (key._tag === "None") return yield* new HttpApiError.NotFound({});
          return yield* serviceApiKeyRow(key.value);
        }),
      )
      .handle("enableApiKeyRateLimit", ({ params }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const key = yield* SqlSchema.findOneOption({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) =>
              sql`UPDATE apikey SET rate_limit_enabled = true, updated_at = ${new Date()} WHERE id = ${id} RETURNING *`,
          })(params.id).pipe(Effect.mapError(internalServerError));
          if (key._tag === "None") return yield* new HttpApiError.NotFound({});
          return yield* serviceApiKeyRow(key.value);
        }),
      )
      .handle("disableApiKeyRateLimit", ({ params }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const key = yield* SqlSchema.findOneOption({
            Request: Schema.String,
            Result: ApiKeyRow,
            execute: (id) =>
              sql`UPDATE apikey SET rate_limit_enabled = false, updated_at = ${new Date()} WHERE id = ${id} RETURNING *`,
          })(params.id).pipe(Effect.mapError(internalServerError));
          if (key._tag === "None") return yield* new HttpApiError.NotFound({});
          return yield* serviceApiKeyRow(key.value);
        }),
      )
      .handle("listUsers", ({ query }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const pattern = `%${query.globalFilter?.trim() ?? ""}%`;
          const filters = sql`WHERE (u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR u.role ILIKE ${pattern})
      ${query.projectId ? sql`AND EXISTS (SELECT 1 FROM project_user pu WHERE pu.user_id = u.id AND pu.project_id = ${query.projectId})` : sql``}`;
          const totals = yield* SqlSchema.findOne({
            Request: Schema.Void,
            Result: CountRow,
            execute: () =>
              sql`SELECT count(*)::int AS count FROM "user" u ${filters}`,
          })(undefined).pipe(Effect.mapError(internalServerError));
          const users = yield* SqlSchema.findAll({
            Request: AdminListQuery,
            Result: AdminUserRow,
            execute: (
              input,
            ) => sql`SELECT u.id, u.name, u.email, u.email_verified, u.image, u.created_at,
        max(s.created_at) AS last_signed_in, u.role, u.banned, u.ban_reason, u.ban_expires
        FROM "user" u LEFT JOIN session s ON s.user_id = u.id ${filters}
        GROUP BY u.id ORDER BY ${orderBy(sql, input, "user")} LIMIT ${input.pageSize} OFFSET ${input.page * input.pageSize}`,
          })(query).pipe(Effect.mapError(internalServerError));
          const ids = users.map(({ id }) => id);
          const projects = ids.length
            ? yield* SqlSchema.findAll({
                Request: Schema.Array(Schema.String),
                Result: ResourcePreviewRow,
                execute: (ids) =>
                  sql`SELECT pu.user_id AS resource_id, p.id, p.name, p.logo FROM project_user pu INNER JOIN project p ON p.id = pu.project_id WHERE ${sql.in("pu.user_id", ids)}`,
              })(ids).pipe(Effect.mapError(internalServerError))
            : [];
          const organizations = ids.length
            ? yield* SqlSchema.findAll({
                Request: Schema.Array(Schema.String),
                Result: ResourcePreviewRow,
                execute: (ids) =>
                  sql`SELECT m.user_id AS resource_id, o.id, o.name, o.logo FROM member m INNER JOIN organization o ON o.id = m.organization_id WHERE ${sql.in("m.user_id", ids)}`,
              })(ids).pipe(Effect.mapError(internalServerError))
            : [];
          const projectsByUser = previewsByResource(projects);
          const organizationsByUser = previewsByResource(organizations);
          return {
            data: users.map((user) => ({
              ...user,
              projects: projectsByUser.get(user.id) ?? [],
              organizations: organizationsByUser.get(user.id) ?? [],
            })),
            meta: paginationMeta(query, totals.count),
          };
        }),
      )
      .handle("listOrganizations", ({ query }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const pattern = `%${query.globalFilter?.trim() ?? ""}%`;
          const filters = sql`WHERE (o.name ILIKE ${pattern} OR o.slug ILIKE ${pattern} OR o.logo ILIKE ${pattern})
      ${query.projectId ? sql`AND EXISTS (SELECT 1 FROM project_organization po WHERE po.organization_id = o.id AND po.project_id = ${query.projectId})` : sql``}`;
          const totals = yield* SqlSchema.findOne({
            Request: Schema.Void,
            Result: CountRow,
            execute: () =>
              sql`SELECT count(*)::int AS count FROM organization o ${filters}`,
          })(undefined).pipe(Effect.mapError(internalServerError));
          const organizations = yield* SqlSchema.findAll({
            Request: AdminListQuery,
            Result: AdminOrganizationRow,
            execute: (
              input,
            ) => sql`SELECT o.*, count(m.id)::int AS member_count FROM organization o
        LEFT JOIN member m ON m.organization_id = o.id ${filters} GROUP BY o.id
        ORDER BY ${orderBy(sql, input, "organization")} LIMIT ${input.pageSize} OFFSET ${input.page * input.pageSize}`,
          })(query).pipe(Effect.mapError(internalServerError));
          const ids = organizations.map(({ id }) => id);
          const members = ids.length
            ? yield* SqlSchema.findAll({
                Request: Schema.Array(Schema.String),
                Result: OrganizationMemberRow,
                execute: (ids) =>
                  sql`SELECT m.organization_id, u.id, u.name, u.image, m.role FROM member m INNER JOIN "user" u ON u.id = m.user_id WHERE ${sql.in("m.organization_id", ids)}`,
              })(ids).pipe(Effect.mapError(internalServerError))
            : [];
          const projects = ids.length
            ? yield* SqlSchema.findAll({
                Request: Schema.Array(Schema.String),
                Result: ResourcePreviewRow,
                execute: (ids) =>
                  sql`SELECT po.organization_id AS resource_id, p.id, p.name, p.logo FROM project_organization po INNER JOIN project p ON p.id = po.project_id WHERE ${sql.in("po.organization_id", ids)}`,
              })(ids).pipe(Effect.mapError(internalServerError))
            : [];
          const projectsByOrganization = previewsByResource(projects);
          return {
            data: organizations.map((organization) => ({
              ...organization,
              memberPreviews: members
                .filter((member) => member.organizationId === organization.id)
                .map(({ id, name, image, role }) => ({
                  id,
                  name,
                  image,
                  role,
                })),
              projects: projectsByOrganization.get(organization.id) ?? [],
            })),
            meta: paginationMeta(query, totals.count),
          };
        }),
      )
      .handle("createOrganization", ({ payload, request }) =>
        Effect.gen(function* () {
          const service = yield* Organizations;
          return yield* service
            .create({ payload })
            .pipe(
              Effect.provide(BetterAuthRequest.make(request)),
              Effect.mapError(internalServerError),
            );
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
            .pipe(
              Effect.provide(BetterAuthRequest.make(request)),
              Effect.mapError(internalServerError),
            );
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
