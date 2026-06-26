import { Schema } from "effect";

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
