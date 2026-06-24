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

export const ServerDomain = Schema.Struct({
  id: Schema.String,
  hostname: Schema.String,
  rootHostname: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  organizationId: Schema.NullOr(Schema.String),
  hostnameId: Schema.String,
  active: Schema.Boolean,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({
  identifier: "ServerDomain",
  title: "Server domain",
  description:
    "An auth-owned custom hostname mapped to a project and optionally an organization.",
  examples: [
    {
      id: "domain_1",
      hostname: "auth.institute.example.com",
      rootHostname: "institute.example.com",
      projectId: "kokobi",
      organizationId: "org_1",
      hostnameId: "cloudflare-hostname-id",
      active: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const ServerCreateDomainPayload = Schema.Struct({
  hostname: Schema.NonEmptyString,
  rootHostname: Schema.NonEmptyString,
  projectId: Schema.optional(Schema.NullOr(Schema.String)),
  organizationId: Schema.optional(Schema.NullOr(Schema.String)),
  managed: Schema.optional(Schema.Boolean),
}).annotate({
  identifier: "ServerCreateDomainPayload",
  title: "Create server domain payload",
  description:
    "Payload used by trusted services to register an auth hostname. Set managed to false when the custom hostname is provisioned externally.",
  examples: [
    {
      hostname: "auth.institute.example.com",
      rootHostname: "institute.example.com",
      projectId: "kokobi",
      organizationId: "org_1",
      managed: true,
    },
  ],
});

export const ServerDomainIdParams = Schema.Struct({
  id: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerDomainIdParams",
  title: "Server domain ID params",
  description: "Domain ID used to return or delete a server domain.",
  examples: [{ id: "domain_1" }],
});

export const ServerDomainHostParams = Schema.Struct({
  hostname: Schema.NonEmptyString,
}).annotate({
  identifier: "ServerDomainHostParams",
  title: "Server domain host params",
  description: "Hostname used to return a server domain.",
  examples: [{ hostname: "auth.institute.example.com" }],
});

export const ServerDomainRecord = Schema.Struct({
  required: Schema.Boolean,
  status: Schema.String,
  type: Schema.String,
  name: Schema.String,
  value: Schema.String,
}).annotate({
  identifier: "ServerDomainRecord",
  title: "Server domain DNS record",
  description: "A DNS record required for an auth-owned custom hostname.",
});

export const ServerDomainRecordsResponse = Schema.Array(
  ServerDomainRecord,
).annotate({
  identifier: "ServerDomainRecordsResponse",
  title: "Server domain records response",
  description: "DNS records required for an auth-owned custom hostname.",
});

export type ServerUsersResponse = typeof ServerUsersResponse.Type;
export type ServerOrganizationsResponse =
  typeof ServerOrganizationsResponse.Type;
export type ServerMembersResponse = typeof ServerMembersResponse.Type;
export type ServerActiveOrganization = typeof ServerActiveOrganization.Type;
export type ServerDomain = typeof ServerDomain.Type;
export type ServerCreateDomainPayload = typeof ServerCreateDomainPayload.Type;
export type ServerDomainRecordsResponse =
  typeof ServerDomainRecordsResponse.Type;
