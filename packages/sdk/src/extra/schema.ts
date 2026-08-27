import { Schema } from "effect";
import { Multipart } from "effect/unstable/http";
import { HttpApiSchema } from "effect/unstable/httpapi";

import {
  OrganizationEmail,
  OrganizationLocale,
  OrganizationPhone,
  OrganizationSocial,
  OrganizationWebsite,
  FormattedOrganizationAddress,
} from "../schema.js";

export const ExtraImageUploadPayload = Schema.Struct({
  file: Multipart.SingleFileSchema,
}).annotate({
  identifier: "ExtraImageUploadPayload",
  title: "Extra image upload payload",
  description:
    "Multipart form data payload containing a single image file for user or organization assets.",
});

export const ExtraImageUploadMultipartPayload = ExtraImageUploadPayload.pipe(
  HttpApiSchema.asMultipartStream(),
);

export const ExtraSetPasswordPayload = Schema.Struct({
  newPassword: Schema.NonEmptyString,
}).annotate({
  identifier: "ExtraSetPasswordPayload",
  title: "Extra set password payload",
  description:
    "Payload used to set a password for the current authenticated user.",
  examples: [{ newPassword: "correct-horse-battery-staple" }],
});

export const ExtraVerifyPasswordPayload = Schema.Struct({
  password: Schema.NonEmptyString,
}).annotate({
  identifier: "ExtraVerifyPasswordPayload",
  title: "Extra verify password payload",
  description:
    "Payload used to verify the current authenticated user's password.",
  examples: [{ password: "correct-horse-battery-staple" }],
});

export const ExtraApiKeyConfigId = Schema.Union([
  Schema.Literal("user"),
  Schema.Literal("organization"),
  Schema.Literal("service"),
]).annotate({
  identifier: "ExtraApiKeyConfigId",
  title: "Extra API key configuration ID",
  description: "The configured API key owner type to verify against.",
  examples: ["user"],
});

export const ExtraApiKeyPermissions = Schema.Record(
  Schema.String,
  Schema.Array(Schema.String),
).annotate({
  identifier: "ExtraApiKeyPermissions",
  title: "Extra API key permissions",
  description: "Resource/action permissions required for API key verification.",
  examples: [{ projects: ["read"] }],
});

export const ExtraCreateApiKeyPayload = Schema.Struct({
  configId: ExtraApiKeyConfigId,
  name: Schema.optional(Schema.NonEmptyString),
  organizationId: Schema.optional(Schema.String),
  permissions: Schema.optional(ExtraApiKeyPermissions),
  referrers: Schema.optional(Schema.Array(Schema.String)),
}).annotate({
  identifier: "ExtraCreateApiKeyPayload",
  title: "Extra create API key payload",
  description:
    "Payload used to create a user or organization API key from the server auth instance.",
  examples: [
    {
      configId: "user",
      name: "Production key",
      permissions: { projects: ["read"] },
      referrers: ["https://app.example.com"],
    },
  ],
});

export const ExtraCreateApiKeyResponse = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
}).annotate({
  identifier: "ExtraCreateApiKeyResponse",
  title: "Extra create API key response",
  description:
    "Response returned after creating an API key. The secret key is only returned once.",
  examples: [{ id: "api-key-id", key: "user_1234567890" }],
});

export const ExtraUpdateApiKeyPayload = Schema.Struct({
  configId: ExtraApiKeyConfigId,
  keyId: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  enabled: Schema.Boolean,
  permissions: Schema.optional(ExtraApiKeyPermissions),
  referrers: Schema.optional(Schema.Array(Schema.String)),
}).annotate({
  identifier: "ExtraUpdateApiKeyPayload",
  title: "Extra update API key payload",
  description:
    "Server-authorized updates for an existing API key, including its permissions.",
  examples: [
    {
      configId: "organization",
      keyId: "api-key-id",
      name: "Production key",
      enabled: true,
      permissions: { "211-search": ["search:execute"] },
      referrers: ["https://app.example.com"],
    },
  ],
});

export const ExtraVerifyApiKeyPayload = Schema.Struct({
  key: Schema.NonEmptyString,
  configId: Schema.optional(ExtraApiKeyConfigId),
}).annotate({
  identifier: "ExtraVerifyApiKeyPayload",
  title: "Extra verify API key payload",
  description:
    "Payload used to verify a KrakStack API key. Project permissions are enforced by consumer access policies.",
  examples: [
    {
      key: "user_1234567890",
      configId: "user",
    },
  ],
});

export const ExtraApiKeyVerificationError = Schema.Struct({
  message: Schema.String,
  code: Schema.String,
}).annotate({
  identifier: "ExtraApiKeyVerificationError",
  title: "Extra API key verification error",
  description: "Structured reason returned when an API key is invalid.",
  examples: [{ message: "API key is invalid", code: "INVALID_API_KEY" }],
});

export const ExtraVerifiedApiKey = Schema.Struct({
  id: Schema.String,
  configId: Schema.String,
  name: Schema.NullOr(Schema.String),
  start: Schema.NullOr(Schema.String),
  prefix: Schema.NullOr(Schema.String),
  referenceId: Schema.String,
  enabled: Schema.NullOr(Schema.Boolean),
  expiresAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  permissions: Schema.NullOr(ExtraApiKeyPermissions),
  metadata: Schema.NullOr(Schema.Unknown),
}).annotate({
  identifier: "ExtraVerifiedApiKey",
  title: "Extra verified API key metadata",
  description: "Non-secret metadata for a verified API key.",
  examples: [
    {
      id: "api-key-id",
      configId: "user",
      name: "Production key",
      start: "user_1234",
      prefix: "user_",
      referenceId: "user-id",
      enabled: true,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      permissions: { projects: ["read"] },
      metadata: null,
    },
  ],
});

export const ExtraVerifyApiKeyResponse = Schema.Struct({
  valid: Schema.Boolean,
  error: Schema.NullOr(ExtraApiKeyVerificationError),
  key: Schema.NullOr(ExtraVerifiedApiKey),
}).annotate({
  identifier: "ExtraVerifyApiKeyResponse",
  title: "Extra verify API key response",
  description: "Result of verifying a remote API key.",
});

export const ExtraProjectPublicConfigQuery = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  clientId: Schema.optional(Schema.String),
  host: Schema.optional(Schema.String),
  rootHost: Schema.optional(Schema.String),
}).annotate({
  identifier: "ExtraProjectPublicConfigQuery",
  title: "Extra project public config query",
  description:
    "Optional project ID, auth host, and OAuth client ID used to resolve public project branding through the proxied auth API.",
  examples: [
    {
      projectId: "project-id",
      host: "auth.example.com",
      rootHost: "example.com",
      clientId: "oauth-client-id",
    },
  ],
});

export const ExtraProjectAuthOptions = Schema.Struct({
  emailPassword: Schema.Boolean,
  emailOtp: Schema.Boolean,
  google: Schema.Boolean,
}).annotate({
  identifier: "ExtraProjectAuthOptions",
  title: "Extra project authentication options",
  description: "Resolved authentication methods visible for auth pages.",
  examples: [
    {
      emailPassword: true,
      emailOtp: true,
      google: true,
    },
  ],
});

export const ExtraProjectPublicConfig = Schema.Struct({
  projectKey: Schema.String,
  name: Schema.NullOr(Schema.String),
  logoUrl: Schema.NullOr(Schema.String),
  authDomain: Schema.NullOr(Schema.String),
  rootDomain: Schema.NullOr(Schema.String),
  themeCss: Schema.NullOr(Schema.String),
  authOptions: ExtraProjectAuthOptions,
}).annotate({
  identifier: "ExtraProjectPublicConfig",
  title: "Extra project public config",
  description:
    "Public white-label configuration used by auth pages for a project.",
  examples: [
    {
      projectKey: "auth.example.com",
      name: "Example project",
      logoUrl: "https://example.com/logo.svg",
      authDomain: "auth.example.com",
      rootDomain: "example.com",
      themeCss:
        '[data-project-theme="auth.example.com"] { --primary: oklch(0.5 0.1 240); }',
      authOptions: {
        emailPassword: true,
        emailOtp: true,
        google: true,
      },
    },
  ],
});

export const ExtraOrganizationPublicProfileQuery = Schema.Struct({
  organizationId: Schema.String,
  locale: Schema.optional(OrganizationLocale),
}).annotate({
  identifier: "ExtraOrganizationPublicProfileQuery",
  title: "Extra organization public profile query",
  description:
    "Organization ID used to resolve public organization display metadata.",
  examples: [{ organizationId: "org_1", locale: "en" }],
});

export const ExtraOrganizationPublicProfile = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  displayName: Schema.String,
  contactEmail: Schema.NullOr(Schema.String),
  emails: Schema.optional(Schema.Array(OrganizationEmail)),
  phones: Schema.optional(Schema.Array(OrganizationPhone)),
  websites: Schema.optional(Schema.Array(OrganizationWebsite)),
  socials: Schema.optional(Schema.Array(OrganizationSocial)),
  addresses: Schema.optional(Schema.Array(FormattedOrganizationAddress)),
  logo: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "ExtraOrganizationPublicProfile",
  title: "Extra organization public profile",
  description:
    "Public organization display metadata used for access and invitation screens.",
  examples: [
    {
      id: "org_1",
      name: "Krak",
      slug: "krak",
      displayName: "Krak",
      contactEmail: null,
      emails: [],
      phones: [],
      websites: [],
      socials: [],
      addresses: [],
      logo: null,
      icon: null,
    },
  ],
});

export const ExtraOkResponse = Schema.Struct({
  ok: Schema.Boolean,
}).annotate({
  identifier: "ExtraOkResponse",
  title: "Extra auth operation response",
  description: "Successful response for custom auth actions.",
  examples: [{ ok: true }],
});

export const ExtraUploadedAsset = Schema.Struct({
  url: Schema.String,
}).annotate({
  identifier: "ExtraUploadedAsset",
  title: "Extra uploaded asset",
  description: "Stable public asset URL returned after an image upload.",
  examples: [
    {
      url: "https://auth.example.com/api/auth/assets/logos/organizations/logo.png",
    },
  ],
});

export class ExtraBadRequest extends Schema.TaggedError<ExtraBadRequest>()(
  "ExtraBadRequest",
  {
    message: Schema.String,
  },
  {
    identifier: "ExtraBadRequest",
    title: "Extra bad request",
    description: "The extra auth operation could not be completed.",
    httpApiStatus: 400,
  },
) {}

export type ExtraImageUploadPayload = typeof ExtraImageUploadPayload.Type;
export type ExtraUploadedAsset = typeof ExtraUploadedAsset.Type;
export type ExtraSetPasswordPayload = typeof ExtraSetPasswordPayload.Type;
export type ExtraVerifyPasswordPayload = typeof ExtraVerifyPasswordPayload.Type;
export type ExtraCreateApiKeyPayload = typeof ExtraCreateApiKeyPayload.Type;
export type ExtraCreateApiKeyResponse = typeof ExtraCreateApiKeyResponse.Type;
export type ExtraUpdateApiKeyPayload = typeof ExtraUpdateApiKeyPayload.Type;
export type ExtraVerifyApiKeyPayload = typeof ExtraVerifyApiKeyPayload.Type;
export type ExtraVerifyApiKeyResponse = typeof ExtraVerifyApiKeyResponse.Type;
export type ExtraProjectPublicConfigQuery =
  typeof ExtraProjectPublicConfigQuery.Type;
export type ExtraProjectPublicConfig = typeof ExtraProjectPublicConfig.Type;
export type ExtraOrganizationPublicProfileQuery =
  typeof ExtraOrganizationPublicProfileQuery.Type;
export type ExtraOrganizationPublicProfile =
  typeof ExtraOrganizationPublicProfile.Type;
export type ExtraOkResponse = typeof ExtraOkResponse.Type;
