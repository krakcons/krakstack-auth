import { Schema } from "effect";

import { PaginatedResponse } from "@/lib/query";
import { Organization } from "@/services/organizations/schema";

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
    },
  ],
});

export const AdminUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  role: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  banReason: Schema.NullOr(Schema.String),
  banExpires: Schema.NullOr(Schema.Date),
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
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
    },
  ],
});

export const PaginatedAdminUsers = PaginatedResponse(AdminUser).annotate({
  identifier: "PaginatedAdminUsers",
  title: "Paginated admin users",
  description: "Paginated administrative user list response.",
});

export const PaginatedOrganizations = PaginatedResponse(Organization).annotate({
  identifier: "PaginatedOrganizations",
  title: "Paginated organizations",
  description: "Paginated administrative organization list response.",
});

export type AdminUser = typeof AdminUser.Type;
