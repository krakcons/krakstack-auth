import { Schema } from "effect";

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.Unknown),
  createdAt: Schema.Date,
}).annotate({
  identifier: "Organization",
  title: "Organization",
  description: "Administrative organization record managed by KrakStack Auth.",
  examples: [
    {
      id: "organization-id",
      name: "KrakStack",
      slug: "krakstack",
      logo: "https://example.com/logo.svg",
      metadata: { tier: "internal" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const OrganizationIdParams = Schema.Struct({
  id: Schema.String,
}).annotate({
  identifier: "OrganizationIdParams",
  title: "Organization ID params",
  description: "Path parameters used to identify an organization.",
  examples: [{ id: "organization-id" }],
});

export const UserIdParams = Schema.Struct({
  userId: Schema.String,
}).annotate({
  identifier: "UserIdParams",
  title: "User ID params",
  description: "Path parameters used to identify a user.",
  examples: [{ userId: "user-id" }],
});

export const ActiveOrganization = Schema.Struct({
  id: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "ActiveOrganization",
  title: "Active organization",
  description:
    "The active organization ID resolved from a user's auth session.",
  examples: [{ id: "organization-id" }],
});

export const CreateOrganizationPayload = Schema.Struct({
  name: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
  logo: Schema.optional(Schema.String),
}).annotate({
  identifier: "CreateOrganizationPayload",
  title: "Create organization payload",
  description: "Payload used by administrators to create an organization.",
  examples: [
    {
      name: "KrakStack",
      slug: "krakstack",
      logo: "https://example.com/logo.svg",
    },
  ],
});

export const UpdateOrganizationPayload = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  slug: Schema.optional(Schema.NonEmptyString),
  logo: Schema.optional(Schema.String),
}).annotate({
  identifier: "UpdateOrganizationPayload",
  title: "Update organization payload",
  description: "Payload used by administrators to update an organization.",
  examples: [
    {
      name: "KrakStack Labs",
      slug: "krakstack-labs",
      logo: "https://example.com/logo.svg",
    },
  ],
});

export const CreateOrganizationPayloadStandard = Schema.toStandardSchemaV1(
  CreateOrganizationPayload,
);

export type Organization = typeof Organization.Type;
export type ActiveOrganization = typeof ActiveOrganization.Type;
export type CreateOrganizationPayload = typeof CreateOrganizationPayload.Type;
export type UpdateOrganizationPayload = typeof UpdateOrganizationPayload.Type;
