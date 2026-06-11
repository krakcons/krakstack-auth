import { Schema } from "effect";

export const OAuthClientMetadata = Schema.Struct({
  branding: Schema.optional(
    Schema.Struct({
      themeCss: Schema.optional(Schema.String),
    }),
  ),
  authOptions: Schema.optional(
    Schema.Struct({
      emailPassword: Schema.optional(Schema.Boolean),
      google: Schema.optional(Schema.Boolean),
      signUp: Schema.optional(Schema.Boolean),
      signUpName: Schema.optional(Schema.Boolean),
    }),
  ),
}).annotate({
  identifier: "OAuthClientMetadata",
  title: "OAuth client metadata",
  description:
    "White-label theme and authentication option settings for an OAuth client.",
  examples: [
    {
      branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
      authOptions: {
        emailPassword: true,
        google: true,
        signUp: false,
        signUpName: true,
      },
    },
  ],
});

export const OAuthClientIdParams = Schema.Struct({
  clientId: Schema.String,
}).annotate({
  identifier: "OAuthClientIdParams",
  title: "OAuth client ID params",
  description: "Path parameters used to identify an OAuth client.",
  examples: [{ clientId: "oauth-client-id" }],
});

export const OAuthAuthOptions = Schema.Struct({
  emailPassword: Schema.Boolean,
  google: Schema.Boolean,
  signUp: Schema.Boolean,
  signUpName: Schema.Boolean,
}).annotate({
  identifier: "OAuthAuthOptions",
  title: "OAuth authentication options",
  description: "Resolved authentication methods visible for an OAuth client.",
  examples: [
    { emailPassword: true, google: true, signUp: true, signUpName: true },
  ],
});

export const OAuthClientPublicConfig = Schema.Struct({
  clientId: Schema.String,
  name: Schema.NullOr(Schema.String),
  logoUrl: Schema.NullOr(Schema.String),
  themeCss: Schema.NullOr(Schema.String),
  authOptions: OAuthAuthOptions,
}).annotate({
  identifier: "OAuthClientPublicConfig",
  title: "OAuth client public config",
  description:
    "Public white-label configuration used by auth pages for an OAuth client.",
  examples: [
    {
      clientId: "oauth-client-id",
      name: "Example app",
      logoUrl: "https://example.com/logo.svg",
      themeCss:
        '[data-oauth-client-theme="oauth-client-id"] { --primary: oklch(0.5 0.1 240); }',
      authOptions: {
        emailPassword: true,
        google: true,
        signUp: false,
        signUpName: true,
      },
    },
  ],
});

export const OAuthClientAdmin = Schema.Struct({
  id: Schema.String,
  clientId: Schema.String,
  name: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  redirectUris: Schema.Array(Schema.String),
  scope: Schema.NullOr(Schema.String),
  disabled: Schema.NullOr(Schema.Boolean),
  metadata: OAuthClientMetadata,
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
      redirectUris: ["https://example.com/callback"],
      scope: "openid profile email",
      disabled: false,
      metadata: {
        branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
        authOptions: {
          emailPassword: true,
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
  redirectUris: Schema.Array(Schema.String),
  scope: Schema.NullOr(Schema.String),
  disabled: Schema.NullOr(Schema.Boolean),
  metadata: OAuthClientMetadata,
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
      redirectUris: ["https://example.com/callback"],
      scope: "openid profile email",
      disabled: false,
      metadata: {
        branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
        authOptions: {
          emailPassword: true,
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
  redirectUris: Schema.NonEmptyArray(Schema.NonEmptyString),
  scope: Schema.optional(Schema.String),
  metadata: OAuthClientMetadata,
}).annotate({
  identifier: "CreateOAuthClientPayload",
  title: "Create OAuth client payload",
  description:
    "Payload used by administrators to register a public PKCE OAuth client.",
  examples: [
    {
      name: "Example app",
      icon: "https://example.com/logo.svg",
      redirectUris: ["https://example.com/callback"],
      scope: "openid profile email",
      metadata: {
        branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
        authOptions: {
          emailPassword: true,
          google: true,
          signUp: true,
          signUpName: true,
        },
      },
    },
  ],
});

export const UpdateOAuthClientPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  scope: Schema.optional(Schema.String),
  metadata: OAuthClientMetadata,
}).annotate({
  identifier: "UpdateOAuthClientPayload",
  title: "Update OAuth client payload",
  description:
    "Payload used by administrators to update OAuth client white-label settings.",
  examples: [
    {
      name: "Example app",
      icon: "https://example.com/logo.svg",
      scope: "openid profile email",
      metadata: {
        branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
        authOptions: {
          emailPassword: true,
          google: false,
          signUp: true,
          signUpName: false,
        },
      },
    },
  ],
});

export const OAuthClientMetadataStandard =
  Schema.toStandardSchemaV1(OAuthClientMetadata);

export type OAuthClientMetadata = typeof OAuthClientMetadata.Type;
export type OAuthClientAdmin = typeof OAuthClientAdmin.Type;
export type OAuthClientCreated = typeof OAuthClientCreated.Type;
export type OAuthClientPublicConfig = typeof OAuthClientPublicConfig.Type;
export type CreateOAuthClientPayload = typeof CreateOAuthClientPayload.Type;
export type UpdateOAuthClientPayload = typeof UpdateOAuthClientPayload.Type;
