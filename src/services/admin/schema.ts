import { ApiKeyPermissionGrant } from "@krak-stack/auth/access";
import { Schema } from "effect";
import { ApiKeyRow, OrganizationRow, UserRow } from "@/db/schema";

export type ApiKeySqlUpdate = {
  -readonly [K in keyof typeof ApiKeyRow.Type]?: (typeof ApiKeyRow.Type)[K];
};

export const CountRow = Schema.Struct({ count: Schema.Number }).annotate({
  identifier: "AdminCountRow",
});
export const SessionActivityRow = Schema.Struct({
  userId: Schema.String,
  updatedAt: Schema.Date,
}).annotate({ identifier: "SessionActivityRow" });
export const SignupRow = Schema.Struct({ createdAt: Schema.Date }).annotate({
  identifier: "SignupRow",
});
export const ProjectConnectionRow = Schema.Struct({
  projectId: Schema.String,
  projectName: Schema.String,
  users: Schema.Number,
  organizations: Schema.Number,
}).annotate({ identifier: "ProjectConnectionRow" });
export const AdminUserRow = Schema.Struct({
  id: UserRow.fields.id,
  name: UserRow.fields.name,
  email: UserRow.fields.email,
  emailVerified: UserRow.fields.emailVerified,
  image: UserRow.fields.image,
  createdAt: UserRow.fields.createdAt,
  lastSignedIn: Schema.NullOr(Schema.Date),
  role: UserRow.fields.role,
  banned: UserRow.fields.banned,
  banReason: UserRow.fields.banReason,
  banExpires: UserRow.fields.banExpires,
}).annotate({ identifier: "AdminUserRow" });
export const AdminOrganizationRow = Schema.Struct({
  ...OrganizationRow.fields,
  memberCount: Schema.Number,
}).annotate({ identifier: "AdminOrganizationRow" });
export const OrganizationMemberRow = Schema.Struct({
  organizationId: Schema.String,
  id: Schema.String,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
  role: Schema.String,
}).annotate({ identifier: "OrganizationMemberPreviewRow" });
export const DashboardTotalsRow = Schema.Struct({
  totalUsers: Schema.Number,
  totalOrganizations: Schema.Number,
  totalProjects: Schema.Number,
  totalDomains: Schema.Number,
  totalApiKeys: Schema.Number,
  totalOauthClients: Schema.Number,
  dailyActiveUsers: Schema.Number,
}).annotate({ identifier: "DashboardTotalsRow" });

export const ApiKeyPermissionsJson = Schema.fromJsonString(
  Schema.NullOr(ApiKeyPermissionGrant),
).annotate({
  identifier: "ApiKeyPermissionsJson",
});
