import { Schema } from "effect";

import { Member, Organization, User } from "../schema";

export const BackendIdsQuery = Schema.Struct({
  ids: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendIdsQuery",
  title: "Backend IDs query",
  description: "Comma-separated resource IDs used to return backend records.",
  examples: [{ ids: "user_1,user_2,user_3" }],
});

export const BackendOrganizationsQuery = Schema.Struct({
  ids: Schema.optional(Schema.NonEmptyString),
  userId: Schema.optional(Schema.NonEmptyString),
}).annotate({
  identifier: "BackendOrganizationsQuery",
  title: "Backend organizations query",
  description:
    "Query used to return organizations. Provide either comma-separated organization IDs or a user ID, but not both.",
  examples: [{ ids: "org_1,org_2" }, { userId: "user_1" }],
});

export const BackendIdParams = Schema.Struct({
  id: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendIdParams",
  title: "Backend ID params",
  description: "Resource ID used to return a backend record.",
  examples: [{ id: "user_1" }],
});

export const BackendUserIdParams = Schema.Struct({
  userId: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendUserIdParams",
  title: "Backend user ID params",
  description: "User ID used to return backend records scoped to a user.",
  examples: [{ userId: "user_1" }],
});

export const BackendOrganizationIdParams = Schema.Struct({
  organizationId: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendOrganizationIdParams",
  title: "Backend organization ID params",
  description: "Organization ID used to return backend organization records.",
  examples: [{ organizationId: "org_1" }],
});

export const BackendMemberParams = Schema.Struct({
  organizationId: Schema.NonEmptyString,
  userId: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendMemberParams",
  title: "Backend member params",
  description: "Organization and user IDs used to return a member record.",
  examples: [{ organizationId: "org_1", userId: "user_1" }],
});

export const BackendActiveOrganization = Schema.Struct({
  id: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "BackendActiveOrganization",
  title: "Backend active organization",
  description: "The active organization ID from a user's latest auth session.",
  examples: [{ id: "org_1" }],
});

export const BackendUsersResponse = Schema.Struct({
  data: Schema.Array(User),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendUsersResponse",
  title: "Backend users response",
  description:
    "Batch user response with records and requested IDs that were not found.",
});

export const BackendOrganizationsResponse = Schema.Struct({
  data: Schema.Array(Organization),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendOrganizationsResponse",
  title: "Backend organizations response",
  description:
    "Batch organization response with records and requested IDs that were not found.",
});

export const BackendMembersResponse = Schema.Array(Member).annotate({
  identifier: "BackendMembersResponse",
  title: "Backend members response",
  description: "Organization members with user contact details.",
});

export type BackendUsersResponse = typeof BackendUsersResponse.Type;
export type BackendOrganizationsResponse =
  typeof BackendOrganizationsResponse.Type;
export type BackendMembersResponse = typeof BackendMembersResponse.Type;
export type BackendActiveOrganization = typeof BackendActiveOrganization.Type;
