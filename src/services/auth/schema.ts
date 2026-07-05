import { Schema } from "effect";

export const SetPasswordPayload = Schema.Struct({
  newPassword: Schema.NonEmptyString,
}).annotate({
  identifier: "SetPasswordPayload",
  title: "Set password payload",
  description:
    "Payload used to set a password for the current authenticated user.",
  examples: [{ newPassword: "correct-horse-battery-staple" }],
});

export const VerifyPasswordPayload = Schema.Struct({
  password: Schema.NonEmptyString,
}).annotate({
  identifier: "VerifyPasswordPayload",
  title: "Verify password payload",
  description:
    "Payload used to verify the current authenticated user's password.",
  examples: [{ password: "correct-horse-battery-staple" }],
});

export const ApiKeyConfigId = Schema.Union([
  Schema.Literal("user"),
  Schema.Literal("organization"),
  Schema.Literal("service"),
]).annotate({
  identifier: "ApiKeyConfigId",
  title: "API key configuration ID",
  description: "The configured API key owner type to verify against.",
  examples: ["user"],
});

export const ApiKeyPermissions = Schema.Record(
  Schema.String,
  Schema.Array(Schema.String),
).annotate({
  identifier: "ApiKeyPermissions",
  title: "API key permissions",
  description: "Resource/action permissions required for API key verification.",
  examples: [{ projects: ["read"] }],
});

export const CreateApiKeyPayload = Schema.Struct({
  configId: ApiKeyConfigId,
  name: Schema.optional(Schema.NonEmptyString),
  organizationId: Schema.optional(Schema.String),
  permissions: Schema.optional(ApiKeyPermissions),
}).annotate({
  identifier: "CreateApiKeyPayload",
  title: "Create API key payload",
  description:
    "Payload used to create a user or organization API key from the server auth instance.",
  examples: [
    {
      configId: "user",
      name: "Production key",
      permissions: { projects: ["read"] },
    },
  ],
});

export const CreateApiKeyResponse = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
}).annotate({
  identifier: "CreateApiKeyResponse",
  title: "Create API key response",
  description:
    "Response returned after creating an API key. The secret key is only returned once.",
  examples: [{ id: "api-key-id", key: "user_1234567890" }],
});

export const VerifyApiKeyPayload = Schema.Struct({
  key: Schema.NonEmptyString,
  configId: Schema.optional(ApiKeyConfigId),
  permissions: Schema.optional(ApiKeyPermissions),
}).annotate({
  identifier: "VerifyApiKeyPayload",
  title: "Verify API key payload",
  description: "Payload used by remote services to verify a KrakStack API key.",
  examples: [
    {
      key: "user_1234567890",
      configId: "user",
      permissions: { projects: ["read"] },
    },
  ],
});

export const ApiKeyVerificationError = Schema.Struct({
  message: Schema.String,
  code: Schema.String,
}).annotate({
  identifier: "ApiKeyVerificationError",
  title: "API key verification error",
  description: "Structured reason returned when an API key is invalid.",
  examples: [{ message: "API key is invalid", code: "INVALID_API_KEY" }],
});

export const VerifiedApiKey = Schema.Struct({
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
  permissions: Schema.NullOr(ApiKeyPermissions),
  metadata: Schema.NullOr(Schema.Unknown),
}).annotate({
  identifier: "VerifiedApiKey",
  title: "Verified API key metadata",
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

export const VerifyApiKeyResponse = Schema.Struct({
  valid: Schema.Boolean,
  error: Schema.NullOr(ApiKeyVerificationError),
  key: Schema.NullOr(VerifiedApiKey),
}).annotate({
  identifier: "VerifyApiKeyResponse",
  title: "Verify API key response",
  description: "Result of verifying a remote API key.",
  examples: [
    {
      valid: true,
      error: null,
      key: {
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
    },
  ],
});

export const AuthProjectPublicConfigQuery = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  clientId: Schema.optional(Schema.String),
  host: Schema.optional(Schema.String),
  rootHost: Schema.optional(Schema.String),
}).annotate({
  identifier: "AuthProjectPublicConfigQuery",
  title: "Auth project public config query",
  description:
    "Optional project ID, auth host, and OAuth client ID used to resolve public project branding through the auth API.",
  examples: [
    {
      projectId: "project-id",
      host: "auth.example.com",
      rootHost: "example.com",
      clientId: "oauth-client-id",
    },
  ],
});

export const AuthProjectAuthOptions = Schema.Struct({
  emailPassword: Schema.Boolean,
  emailOtp: Schema.Boolean,
  google: Schema.Boolean,
  signUp: Schema.Boolean,
  signUpName: Schema.Boolean,
}).annotate({
  identifier: "AuthProjectAuthOptions",
  title: "Auth project authentication options",
  description: "Resolved authentication methods visible for auth pages.",
  examples: [
    {
      emailPassword: true,
      emailOtp: true,
      google: true,
      signUp: true,
      signUpName: true,
    },
  ],
});

export const AuthProjectPublicConfig = Schema.Struct({
  projectKey: Schema.String,
  name: Schema.NullOr(Schema.String),
  logoUrl: Schema.NullOr(Schema.String),
  authDomain: Schema.NullOr(Schema.String),
  rootDomain: Schema.NullOr(Schema.String),
  themeCss: Schema.NullOr(Schema.String),
  authOptions: AuthProjectAuthOptions,
}).annotate({
  identifier: "AuthProjectPublicConfig",
  title: "Auth project public config",
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
        signUp: false,
        signUpName: true,
      },
    },
  ],
});

export const AuthOkResponse = Schema.Struct({
  ok: Schema.Boolean,
}).annotate({
  identifier: "AuthOkResponse",
  title: "Auth operation response",
  description: "Successful response for custom auth actions.",
  examples: [{ ok: true }],
});

export class AuthBadRequest extends Schema.ErrorClass<AuthBadRequest>(
  "AuthBadRequest",
)(
  {
    _tag: Schema.tag("AuthBadRequest"),
    message: Schema.String,
  },
  {
    identifier: "AuthBadRequest",
    title: "Auth bad request",
    description: "The auth operation could not be completed.",
    httpApiStatus: 400,
  },
) {}
