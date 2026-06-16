import { Schema } from "effect";

import { Member, Organization, User } from "../schema";

export const ServerIdsQuery = Schema.Struct({
  ids: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerIdsQuery",
  title: "Server IDs query",
  description: "Comma-separated resource IDs used to return server records.",
  examples: [{ ids: "user_1,user_2,user_3" }],
});

export const ServerOrganizationsQuery = Schema.Struct({
  ids: Schema.optional(Schema.NonEmptyString),
  userId: Schema.optional(Schema.NonEmptyString),
}).annotate({
  identifier: "ServerOrganizationsQuery",
  title: "Server organizations query",
  description:
    "Query used to return organizations. Provide either comma-separated organization IDs or a user ID, but not both.",
  examples: [{ ids: "org_1,org_2" }, { userId: "user_1" }],
});

export const ServerIdParams = Schema.Struct({
  id: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerIdParams",
  title: "Server ID params",
  description: "Resource ID used to return a server record.",
  examples: [{ id: "user_1" }],
});

export const ServerUserIdParams = Schema.Struct({
  userId: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerUserIdParams",
  title: "Server user ID params",
  description: "User ID used to return server records scoped to a user.",
  examples: [{ userId: "user_1" }],
});

export const ServerOrganizationIdParams = Schema.Struct({
  organizationId: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerOrganizationIdParams",
  title: "Server organization ID params",
  description: "Organization ID used to return server organization records.",
  examples: [{ organizationId: "org_1" }],
});

export const ServerMemberParams = Schema.Struct({
  organizationId: Schema.NonEmptyString,
  userId: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerMemberParams",
  title: "Server member params",
  description: "Organization and user IDs used to return a member record.",
  examples: [{ organizationId: "org_1", userId: "user_1" }],
});

export const ServerActiveOrganization = Schema.Struct({
  id: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "ServerActiveOrganization",
  title: "Server active organization",
  description: "The active organization ID from a user's latest auth session.",
  examples: [{ id: "org_1" }],
});

export const ServerUsersResponse = Schema.Struct({
  data: Schema.Array(User),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "ServerUsersResponse",
  title: "Server users response",
  description:
    "Batch user response with records and requested IDs that were not found.",
});

export const ServerOrganizationsResponse = Schema.Struct({
  data: Schema.Array(Organization),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "ServerOrganizationsResponse",
  title: "Server organizations response",
  description:
    "Batch organization response with records and requested IDs that were not found.",
});

export const ServerMembersResponse = Schema.Array(Member).annotate({
  identifier: "ServerMembersResponse",
  title: "Server members response",
  description: "Organization members with user contact details.",
});

export type ServerUsersResponse = typeof ServerUsersResponse.Type;
export type ServerOrganizationsResponse =
  typeof ServerOrganizationsResponse.Type;
export type ServerMembersResponse = typeof ServerMembersResponse.Type;
export type ServerActiveOrganization = typeof ServerActiveOrganization.Type;
