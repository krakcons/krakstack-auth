import { Schema } from "effect";

import { AuthMember, AuthOrganization, AuthUser } from "@/lib/auth-schema";

export const BackendAuthIdsQuery = Schema.Struct({
  ids: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendAuthIdsQuery",
  title: "Backend auth IDs query",
  description: "Comma-separated resource IDs used to return backend records.",
  examples: [{ ids: "user_1,user_2,user_3" }],
});

export const BackendAuthOrganizationsQuery = Schema.Struct({
  ids: Schema.optional(Schema.NonEmptyString),
  userId: Schema.optional(Schema.NonEmptyString),
}).annotate({
  identifier: "BackendAuthOrganizationsQuery",
  title: "Backend auth organizations query",
  description:
    "Query used to return organizations. Provide either comma-separated organization IDs or a user ID, but not both.",
  examples: [{ ids: "org_1,org_2" }, { userId: "user_1" }],
});

export const BackendAuthIdParams = Schema.Struct({
  id: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendAuthIdParams",
  title: "Backend auth ID params",
  description: "Resource ID used to return a backend record.",
  examples: [{ id: "user_1" }],
});

export const BackendAuthUserIdParams = Schema.Struct({
  userId: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendAuthUserIdParams",
  title: "Backend auth user ID params",
  description: "User ID used to return backend records scoped to a user.",
  examples: [{ userId: "user_1" }],
});

export const BackendAuthOrganizationIdParams = Schema.Struct({
  organizationId: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendAuthOrganizationIdParams",
  title: "Backend auth organization ID params",
  description: "Organization ID used to return backend organization records.",
  examples: [{ organizationId: "org_1" }],
});

export const BackendAuthMemberParams = Schema.Struct({
  organizationId: Schema.NonEmptyString,
  userId: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendAuthMemberParams",
  title: "Backend auth member params",
  description: "Organization and user IDs used to return a member record.",
  examples: [{ organizationId: "org_1", userId: "user_1" }],
});

export const BackendAuthActiveOrganization = Schema.Struct({
  id: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "BackendAuthActiveOrganization",
  title: "Backend auth active organization",
  description: "The active organization ID from a user's latest auth session.",
  examples: [{ id: "org_1" }],
});

export const BackendAuthUsersResponse = Schema.Struct({
  data: Schema.Array(AuthUser),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendAuthUsersResponse",
  title: "Backend auth users response",
  description:
    "Batch user response with records and requested IDs that were not found.",
});

export const BackendAuthOrganizationsResponse = Schema.Struct({
  data: Schema.Array(AuthOrganization),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendAuthOrganizationsResponse",
  title: "Backend auth organizations response",
  description:
    "Batch organization response with records and requested IDs that were not found.",
});

export const BackendAuthOrganizationChildrenResponse = Schema.Array(
  AuthOrganization,
).annotate({
  identifier: "BackendAuthOrganizationChildrenResponse",
  title: "Backend auth organization children response",
  description: "Direct child organizations belonging to an organization.",
});

export const BackendAuthMembersResponse = Schema.Array(AuthMember).annotate({
  identifier: "BackendAuthMembersResponse",
  title: "Backend auth members response",
  description: "Organization members with user contact details.",
});

export type BackendAuthUsersResponse = typeof BackendAuthUsersResponse.Type;
export type BackendAuthOrganizationsResponse =
  typeof BackendAuthOrganizationsResponse.Type;
export type BackendAuthOrganizationChildrenResponse =
  typeof BackendAuthOrganizationChildrenResponse.Type;
export type BackendAuthMembersResponse = typeof BackendAuthMembersResponse.Type;
export type BackendAuthActiveOrganization =
  typeof BackendAuthActiveOrganization.Type;
