import { Schema } from "effect";

import { ProjectData } from "@/services/projects/schema";

export const OAuthClientIdParams = Schema.Struct({
  clientId: Schema.String,
}).annotate({
  identifier: "OAuthClientIdParams",
  title: "OAuth client ID params",
  description: "Path parameters used to identify an OAuth client.",
  examples: [{ clientId: "oauth-client-id" }],
});

export const OAuthClientAdmin = Schema.Struct({
  id: Schema.String,
  clientId: Schema.String,
  name: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  projectId: Schema.NullOr(Schema.String),
  projectName: Schema.NullOr(Schema.String),
  projectLogo: Schema.NullOr(Schema.String),
  redirectUris: Schema.Array(Schema.String),
  domains: Schema.Array(Schema.String),
  scope: Schema.NullOr(Schema.String),
  disabled: Schema.NullOr(Schema.Boolean),
  projectData: ProjectData,
}).annotate({
  identifier: "OAuthClientAdmin",
  title: "OAuth client admin record",
  description: "Administrative OAuth client configuration.",
  examples: [
    {
      id: "client-row-id",
      clientId: "oauth-client-id",
      name: "Example app",
      icon: null,
      projectId: "project-id",
      projectName: "Example project",
      projectLogo: null,
      redirectUris: ["https://example.com/callback"],
      domains: [],
      scope: "openid profile email",
      disabled: false,
      projectData: {
        branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
        authOptions: {
          emailPassword: true,
          emailOtp: true,
          google: true,
          signUp: true,
          signUpName: true,
        },
      },
    },
  ],
});

export const OAuthClientCreated = Schema.Struct({
  id: Schema.String,
  clientId: Schema.String,
  clientSecret: Schema.String,
  name: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  projectId: Schema.NullOr(Schema.String),
  projectName: Schema.NullOr(Schema.String),
  projectLogo: Schema.NullOr(Schema.String),
  redirectUris: Schema.Array(Schema.String),
  domains: Schema.Array(Schema.String),
  scope: Schema.NullOr(Schema.String),
  disabled: Schema.NullOr(Schema.Boolean),
  projectData: ProjectData,
}).annotate({
  identifier: "OAuthClientCreated",
  title: "Created OAuth client credentials",
  description:
    "Administrative OAuth client configuration returned once after creation, including the generated client secret.",
  examples: [
    {
      id: "client-row-id",
      clientId: "oauth-client-id",
      clientSecret: "oauth-client-secret",
      name: "Example app",
      icon: null,
      projectId: "project-id",
      projectName: "Example project",
      projectLogo: null,
      redirectUris: ["https://example.com/callback"],
      domains: [],
      scope: "openid profile email",
      disabled: false,
      projectData: {
        branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
        authOptions: {
          emailPassword: true,
          emailOtp: true,
          google: true,
          signUp: true,
          signUpName: true,
        },
      },
    },
  ],
});

export const CreateOAuthClientPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  projectId: Schema.optional(Schema.NullOr(Schema.String)),
  redirectUris: Schema.NonEmptyArray(Schema.NonEmptyString),
  scope: Schema.optional(Schema.String),
}).annotate({
  identifier: "CreateOAuthClientPayload",
  title: "Create OAuth client payload",
  description:
    "Payload used by administrators to register a public PKCE OAuth client.",
  examples: [
    {
      name: "Example app",
      icon: "https://example.com/logo.svg",
      projectId: "project-id",
      redirectUris: ["https://example.com/callback"],
      scope: "openid profile email",
    },
  ],
});

export const UpdateOAuthClientPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  projectId: Schema.optional(Schema.NullOr(Schema.String)),
  redirectUris: Schema.optional(Schema.NonEmptyArray(Schema.NonEmptyString)),
  scope: Schema.optional(Schema.String),
}).annotate({
  identifier: "UpdateOAuthClientPayload",
  title: "Update OAuth client payload",
  description:
    "Payload used by administrators to update OAuth client redirect URIs and white-label settings.",
  examples: [
    {
      name: "Example app",
      icon: "https://example.com/logo.svg",
      projectId: "project-id",
      redirectUris: ["https://example.com/callback"],
      scope: "openid profile email",
    },
  ],
});

export type OAuthClientAdmin = typeof OAuthClientAdmin.Type;
export type OAuthClientCreated = typeof OAuthClientCreated.Type;
export type CreateOAuthClientPayload = typeof CreateOAuthClientPayload.Type;
export type UpdateOAuthClientPayload = typeof UpdateOAuthClientPayload.Type;
