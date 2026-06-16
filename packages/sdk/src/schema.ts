import { Schema } from "effect";

export const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  role: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({
  identifier: "User",
  title: "User",
  description: "Stable central auth user record.",
  examples: [
    {
      id: "user_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      image: null,
      role: "admin",
      banned: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const Session = Schema.Struct({
  id: Schema.String,
  expiresAt: Schema.Date,
  token: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
  userAgent: Schema.optional(Schema.NullOr(Schema.String)),
  userId: Schema.String,
  impersonatedBy: Schema.optional(Schema.NullOr(Schema.String)),
  activeOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({
  identifier: "Session",
  title: "Session",
  description: "Current Better Auth browser session record.",
  examples: [
    {
      id: "session_1",
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      token: "session-token",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
      userId: "user_1",
      impersonatedBy: null,
      activeOrganizationId: "org_1",
    },
  ],
});

export const OrganizationLocale = Schema.Union([
  Schema.Literal("en"),
  Schema.Literal("fr"),
]).annotate({
  identifier: "OrganizationLocale",
  title: "Organization locale",
  description: "Supported organization translation locale.",
  examples: ["en", "fr"],
});

export const OrganizationTranslation = Schema.Struct({
  locale: OrganizationLocale,
  name: Schema.String,
  logo: Schema.NullOr(Schema.String),
  contactEmail: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "OrganizationTranslation",
  title: "Organization translation",
  description: "Localized display metadata for an organization.",
  examples: [
    {
      locale: "en",
      name: "KrakStack",
      logo: "https://example.com/logo.svg",
      contactEmail: "team@example.com",
      location: "Montreal, QC",
    },
  ],
});

export const OrganizationMetadata = Schema.Struct({
  translations: Schema.Array(OrganizationTranslation),
}).annotate({
  identifier: "OrganizationMetadata",
  title: "Organization metadata",
  description:
    "Localized names, logos, contact emails, and locations stored on an organization record.",
  examples: [
    {
      translations: [
        {
          locale: "en",
          name: "KrakStack",
          logo: "https://example.com/logo.svg",
          contactEmail: "team@example.com",
          location: "Montreal, QC",
        },
      ],
    },
  ],
});

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(OrganizationMetadata),
  createdAt: Schema.Date,
}).annotate({
  identifier: "Organization",
  title: "Organization",
  description: "Stable central auth organization record.",
  examples: [
    {
      id: "org_1",
      name: "KrakStack",
      slug: "krakstack",
      logo: null,
      metadata: {
        translations: [
          {
            locale: "en",
            name: "KrakStack",
            logo: null,
            contactEmail: "team@example.com",
            location: "Montreal, QC",
          },
        ],
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const Member = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  userId: Schema.String,
  role: Schema.String,
  createdAt: Schema.Date,
  user: User,
}).annotate({
  identifier: "Member",
  title: "Member",
  description: "Stable central auth organization member record.",
  examples: [
    {
      id: "member_1",
      organizationId: "org_1",
      userId: "user_1",
      role: "admin",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: {
        id: "user_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        image: null,
        role: "admin",
        banned: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  ],
});

export type User = typeof User.Type;
export type Session = typeof Session.Type;
export type OrganizationLocale = typeof OrganizationLocale.Type;
export type OrganizationTranslation = typeof OrganizationTranslation.Type;
export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type Organization = typeof Organization.Type;
export type Member = typeof Member.Type;
