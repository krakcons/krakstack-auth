import { Schema } from "effect";

import { PaginatedResponse, Query } from "../query";

import {
  ServerCreateDomainPayload,
  ServerDomain,
  ServerDomainIdParams,
  ServerDomainRecordsResponse,
  ServerUpdateDomainPayload,
} from "../server/schema";

export const AdminListQuery = Schema.Struct({
  ...Query.fields,
  projectId: Schema.optional(Schema.String),
}).annotate({
  identifier: "AdminListQuery",
  title: "Admin list query",
  description:
    "Paginated administrative list query optionally scoped to linked project records.",
  examples: [{ page: 0, pageSize: 10, projectId: "project-id" }],
});

export const AdminProjectPreview = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  logo: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "AdminProjectPreview",
  title: "Admin project preview",
  description:
    "Project summary displayed in administrative relationship lists.",
});

export const AdminOrganizationPreview = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  logo: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "AdminOrganizationPreview",
  title: "Admin organization preview",
  description:
    "Organization summary displayed in administrative relationship lists.",
});

export const AdminUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  lastSignedIn: Schema.NullOr(Schema.Date),
  role: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  banReason: Schema.NullOr(Schema.String),
  banExpires: Schema.NullOr(Schema.Date),
  organizations: Schema.Array(AdminOrganizationPreview),
  projects: Schema.Array(AdminProjectPreview),
}).annotate({
  identifier: "AdminUser",
  title: "Admin user",
  description: "Administrative user record returned in paginated user lists.",
  examples: [
    {
      id: "user-id",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-02T00:00:00.000Z"),
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
      organizations: [{ id: "organization-id", name: "KrakStack", logo: null }],
      projects: [{ id: "project-id", name: "Portal", logo: null }],
    },
  ],
});

export const AdminOrganizationMember = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "AdminOrganizationMember",
  title: "Admin organization member",
  description: "Member summary displayed in administrative organization lists.",
});

export const AdminOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.NullOr(Schema.String)),
  userId: Schema.optional(Schema.NullOr(Schema.String)),
  parentId: Schema.optional(Schema.NullOr(Schema.String)),
  memberCount: Schema.optional(Schema.Number),
  memberPreviews: Schema.optional(Schema.Array(AdminOrganizationMember)),
  projects: Schema.optional(Schema.Array(AdminProjectPreview)),
  createdAt: Schema.Date,
}).annotate({
  identifier: "AdminOrganization",
  title: "Admin organization",
  description: "Administrative organization record managed by KrakStack Auth.",
  examples: [
    {
      id: "organization-id",
      name: "KrakStack",
      slug: "krakstack",
      logo: "https://example.com/logo.svg",
      metadata: '{"tier":"internal"}',
      userId: null,
      parentId: null,
      memberCount: 12,
      memberPreviews: [{ id: "user-id", name: "Ada Lovelace", image: null }],
      projects: [{ id: "project-id", name: "Portal", logo: null }],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const AdminOrganizationIdParams = Schema.Struct({
  id: Schema.String,
}).annotate({
  identifier: "AdminOrganizationIdParams",
  title: "Admin organization ID params",
  description: "Path parameters used to identify an organization.",
  examples: [{ id: "organization-id" }],
});

export const AdminApiKeyIdParams = Schema.Struct({
  id: Schema.String,
}).annotate({
  identifier: "AdminApiKeyIdParams",
  title: "Admin API key ID params",
  description: "Path parameters used to identify an API key.",
  examples: [{ id: "api-key-id" }],
});

export const AdminApiKey = Schema.Struct({
  id: Schema.String,
  configId: Schema.String,
  name: Schema.NullOr(Schema.String),
  start: Schema.NullOr(Schema.String),
  referenceId: Schema.String,
  prefix: Schema.NullOr(Schema.String),
  enabled: Schema.Boolean,
  rateLimitEnabled: Schema.Boolean,
  rateLimitTimeWindow: Schema.NullOr(Schema.Number),
  rateLimitMax: Schema.NullOr(Schema.Number),
  requestCount: Schema.Number,
  remaining: Schema.NullOr(Schema.Number),
  lastRequest: Schema.NullOr(Schema.Date),
  expiresAt: Schema.NullOr(Schema.Date),
  referrers: Schema.Array(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({
  identifier: "AdminApiKey",
  title: "Admin API key",
  description: "API key metadata returned to administrators.",
  examples: [
    {
      id: "api-key-id",
      configId: "service",
      name: "Production service",
      start: "svc_1234",
      referenceId: "user-id",
      prefix: "svc_",
      enabled: true,
      rateLimitEnabled: true,
      rateLimitTimeWindow: 86400000,
      rateLimitMax: 10000,
      requestCount: 0,
      remaining: null,
      lastRequest: null,
      expiresAt: null,
      referrers: ["https://app.example.com"],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const AdminUpdateApiKeyPayload = Schema.Struct({
  name: Schema.optional(Schema.NullOr(Schema.String)),
  enabled: Schema.optional(Schema.Boolean),
  rateLimitEnabled: Schema.optional(Schema.Boolean),
  rateLimitMax: Schema.optional(Schema.NullOr(Schema.Number)),
  rateLimitTimeWindow: Schema.optional(Schema.NullOr(Schema.Number)),
  referrers: Schema.optional(Schema.Array(Schema.String)),
}).annotate({
  identifier: "AdminUpdateApiKeyPayload",
  title: "Update API key payload",
  description:
    "Payload used by administrators to update API key metadata and rate limits.",
  examples: [
    {
      name: "Production service",
      enabled: true,
      rateLimitEnabled: true,
      rateLimitMax: 10000,
      rateLimitTimeWindow: 86400000,
      referrers: ["https://app.example.com"],
    },
  ],
});

export const AdminCreateOrganizationPayload = Schema.Struct({
  name: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
  logo: Schema.optional(Schema.String),
  parentId: Schema.optional(Schema.String),
}).annotate({
  identifier: "AdminCreateOrganizationPayload",
  title: "Create organization payload",
  description: "Payload used by administrators to create an organization.",
  examples: [{ name: "KrakStack", slug: "krakstack" }],
});

export const AdminUpdateOrganizationPayload = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  slug: Schema.optional(Schema.NonEmptyString),
  logo: Schema.optional(Schema.String),
  parentId: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({
  identifier: "AdminUpdateOrganizationPayload",
  title: "Update organization payload",
  description: "Payload used by administrators to update an organization.",
  examples: [{ name: "KrakStack Labs", slug: "krakstack-labs" }],
});

export const DashboardStatsQuery = Schema.Struct({
  days: Schema.optional(
    Schema.Union([
      Schema.Literal("7"),
      Schema.Literal("14"),
      Schema.Literal("30"),
      Schema.Literal("90"),
    ]),
  ),
}).annotate({
  identifier: "DashboardStatsQuery",
  title: "Dashboard stats query",
  description: "Time range used for dashboard chart series.",
  examples: [{ days: "14" }],
});

export const DailyActiveUsersByDay = Schema.Struct({
  date: Schema.String,
  count: Schema.Number,
}).annotate({
  identifier: "DailyActiveUsersByDay",
  title: "Daily active users by day",
  description: "Distinct authenticated users active on a calendar day.",
  examples: [{ date: "2026-06-26", count: 18 }],
});

export const SignupsByDay = Schema.Struct({
  date: Schema.String,
  count: Schema.Number,
}).annotate({
  identifier: "SignupsByDay",
  title: "Signups by day",
  description: "Users registered on a calendar day.",
  examples: [{ date: "2026-06-26", count: 4 }],
});

export const ProjectConnections = Schema.Struct({
  projectId: Schema.String,
  projectName: Schema.String,
  users: Schema.Number,
  organizations: Schema.Number,
}).annotate({
  identifier: "ProjectConnections",
  title: "Project connections",
  description: "Number of connected users and organizations for a project.",
  examples: [
    {
      projectId: "project-id",
      projectName: "Dashboard",
      users: 12,
      organizations: 3,
    },
  ],
});

export const DashboardStatsResponse = Schema.Struct({
  totalUsers: Schema.Number,
  totalOrganizations: Schema.Number,
  totalProjects: Schema.Number,
  totalDomains: Schema.Number,
  totalApiKeys: Schema.Number,
  totalOauthClients: Schema.Number,
  dailyActiveUsers: Schema.Number,
  dailyActiveUsersByDay: Schema.Array(DailyActiveUsersByDay),
  signupsByDay: Schema.Array(SignupsByDay),
  projectConnections: Schema.Array(ProjectConnections),
}).annotate({
  identifier: "DashboardStatsResponse",
  title: "Dashboard stats response",
  description: "Administrative dashboard statistics.",
  examples: [
    {
      totalUsers: 42,
      totalOrganizations: 3,
      totalProjects: 2,
      totalDomains: 5,
      totalApiKeys: 7,
      totalOauthClients: 1,
      dailyActiveUsers: 18,
      dailyActiveUsersByDay: [{ date: "2026-06-26", count: 18 }],
      signupsByDay: [{ date: "2026-06-26", count: 4 }],
      projectConnections: [
        {
          projectId: "project-id",
          projectName: "Dashboard",
          users: 12,
          organizations: 3,
        },
      ],
    },
  ],
});

export const PaginatedAdminUsers = PaginatedResponse(AdminUser).annotate({
  identifier: "PaginatedAdminUsers",
  title: "Paginated admin users",
  description: "Paginated administrative user list response.",
});

export const PaginatedAdminOrganizations = PaginatedResponse(
  AdminOrganization,
).annotate({
  identifier: "PaginatedAdminOrganizations",
  title: "Paginated admin organizations",
  description: "Paginated administrative organization list response.",
});

export type AdminListQuery = typeof AdminListQuery.Type;
export type AdminUser = typeof AdminUser.Type;
export type AdminOrganizationPreview = typeof AdminOrganizationPreview.Type;
export type AdminProjectPreview = typeof AdminProjectPreview.Type;
export type AdminOrganization = typeof AdminOrganization.Type;
export type AdminOrganizationMember = typeof AdminOrganizationMember.Type;
export type AdminApiKey = typeof AdminApiKey.Type;
export type AdminUpdateApiKeyPayload = typeof AdminUpdateApiKeyPayload.Type;
export type AdminCreateOrganizationPayload =
  typeof AdminCreateOrganizationPayload.Type;
export type AdminUpdateOrganizationPayload =
  typeof AdminUpdateOrganizationPayload.Type;

export {
  ServerCreateDomainPayload,
  ServerDomain,
  ServerDomainIdParams,
  ServerDomainRecordsResponse,
  ServerUpdateDomainPayload,
};
export { SortParamsFromString } from "../query";
