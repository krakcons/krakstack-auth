import { Schema } from "effect";

export const AuthUser = Schema.Struct({
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
  identifier: "AuthUser",
  title: "Auth user",
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

export const AuthOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.Date,
}).annotate({
  identifier: "AuthOrganization",
  title: "Auth organization",
  description: "Stable central auth organization record.",
  examples: [
    {
      id: "org_1",
      name: "KrakStack",
      slug: "krakstack",
      logo: null,
      metadata: { tier: "internal" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export type AuthUser = typeof AuthUser.Type;
export type AuthOrganization = typeof AuthOrganization.Type;
