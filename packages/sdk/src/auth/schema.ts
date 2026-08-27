import { Schema } from "effect";

const JsonRecord = Schema.Record(Schema.String, Schema.Json);
const StringArrayRecord = Schema.Record(
  Schema.String,
  Schema.Array(Schema.String),
);

export const AuthUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  role: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  banReason: Schema.optional(Schema.NullOr(Schema.String)),
  banExpires: Schema.optional(Schema.NullOr(Schema.DateFromString)),
  twoFactorEnabled: Schema.optional(Schema.Boolean),
  lastLoginMethod: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}).annotate({
  identifier: "AuthUser",
  title: "Auth user",
  description: "User record returned by the authentication service.",
});

export const AuthSession = Schema.Struct({
  id: Schema.String,
  expiresAt: Schema.DateFromString,
  token: Schema.String,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
  ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
  userAgent: Schema.optional(Schema.NullOr(Schema.String)),
  userId: Schema.String,
  impersonatedBy: Schema.optional(Schema.NullOr(Schema.String)),
  impersonatedByOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
  activeOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({
  identifier: "AuthSession",
  title: "Auth session",
  description: "Browser authentication session.",
});

export const AuthSessionResponse = Schema.Struct({
  session: AuthSession,
  user: AuthUser,
}).annotate({
  identifier: "AuthSessionResponse",
  title: "Auth session response",
});

export const GetSessionResponse = Schema.NullOr(AuthSessionResponse).annotate({
  identifier: "GetSessionResponse",
  title: "Get session response",
  description: "Current session and user, or null when signed out.",
});

export const GetSessionQuery = Schema.Struct({
  disableCookieCache: Schema.optional(Schema.String),
  disableRefresh: Schema.optional(Schema.String),
}).annotate({
  identifier: "GetSessionQuery",
  title: "Get session query",
});

export const AuthStatusResponse = Schema.Struct({
  status: Schema.Boolean,
}).annotate({ identifier: "AuthStatusResponse", title: "Status response" });

export const AuthSuccessResponse = Schema.Struct({
  success: Schema.Boolean,
}).annotate({ identifier: "AuthSuccessResponse", title: "Success response" });

export const AuthErrorBody = Schema.Struct({
  code: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
}).annotate({
  identifier: "AuthErrorBody",
  title: "Auth error",
  description: "Wire error returned by an authentication endpoint.",
});

const authErrorFields = <const Tag extends string>(tag: Tag) => ({
  _tag: Schema.tagDefaultOmit(tag),
  ...AuthErrorBody.fields,
});

export class AuthBadRequest extends Schema.TaggedError<AuthBadRequest>()(
  "AuthBadRequest",
  authErrorFields("AuthBadRequest"),
  {
    identifier: "AuthBadRequest",
    title: "Bad request",
    httpApiStatus: 400,
  },
) {}

export class AuthUnauthorized extends Schema.TaggedError<AuthUnauthorized>()(
  "AuthUnauthorized",
  authErrorFields("AuthUnauthorized"),
  {
    identifier: "AuthUnauthorized",
    title: "Unauthorized",
    httpApiStatus: 401,
  },
) {}

export class AuthForbidden extends Schema.TaggedError<AuthForbidden>()(
  "AuthForbidden",
  authErrorFields("AuthForbidden"),
  {
    identifier: "AuthForbidden",
    title: "Forbidden",
    httpApiStatus: 403,
  },
) {}

export class AuthNotFound extends Schema.TaggedError<AuthNotFound>()(
  "AuthNotFound",
  authErrorFields("AuthNotFound"),
  {
    identifier: "AuthNotFound",
    title: "Not found",
    httpApiStatus: 404,
  },
) {}

export class AuthConflict extends Schema.TaggedError<AuthConflict>()(
  "AuthConflict",
  authErrorFields("AuthConflict"),
  {
    identifier: "AuthConflict",
    title: "Conflict",
    httpApiStatus: 409,
  },
) {}

export class AuthExpectationFailed extends Schema.TaggedError<AuthExpectationFailed>()(
  "AuthExpectationFailed",
  authErrorFields("AuthExpectationFailed"),
  {
    identifier: "AuthExpectationFailed",
    title: "Expectation failed",
    httpApiStatus: 417,
  },
) {}

export class AuthTooManyRequests extends Schema.TaggedError<AuthTooManyRequests>()(
  "AuthTooManyRequests",
  authErrorFields("AuthTooManyRequests"),
  {
    identifier: "AuthTooManyRequests",
    title: "Too many requests",
    httpApiStatus: 429,
  },
) {}

export class AuthInternalServerError extends Schema.TaggedError<AuthInternalServerError>()(
  "AuthInternalServerError",
  authErrorFields("AuthInternalServerError"),
  {
    identifier: "AuthInternalServerError",
    title: "Internal server error",
    httpApiStatus: 500,
  },
) {}

export const UpdateUserPayload = Schema.Struct({
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({ identifier: "UpdateUserPayload", title: "Update user payload" });

export const SignInEmailPayload = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
  callbackURL: Schema.optional(Schema.String),
  rememberMe: Schema.optional(Schema.Boolean),
  oauth_query: Schema.optional(Schema.String),
}).annotate({
  identifier: "SignInEmailPayload",
  title: "Email sign-in payload",
});

export const SignInEmailResponse = Schema.Union([
  Schema.Struct({
    redirect: Schema.Boolean,
    token: Schema.String,
    url: Schema.optional(Schema.NullOr(Schema.String)),
    user: AuthUser,
  }),
  Schema.Struct({
    twoFactorRedirect: Schema.Literal(true),
    twoFactorMethods: Schema.Array(Schema.String),
    url: Schema.optional(Schema.NullOr(Schema.String)),
  }),
]).annotate({
  identifier: "SignInEmailResponse",
  title: "Email sign-in response",
});

export const SignInEmailOtpPayload = Schema.Struct({
  email: Schema.String,
  otp: Schema.String,
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.String),
}).annotate({
  identifier: "SignInEmailOtpPayload",
  title: "Email OTP sign-in payload",
});

export const SignInResponse = Schema.Struct({
  token: Schema.optional(Schema.String),
  user: AuthUser,
}).annotate({ identifier: "SignInResponse", title: "Sign-in response" });

export const SocialIdToken = Schema.Struct({
  token: Schema.String,
  nonce: Schema.optional(Schema.String),
  accessToken: Schema.optional(Schema.String),
  refreshToken: Schema.optional(Schema.String),
  expiresAt: Schema.optional(Schema.Number),
  user: Schema.optional(
    Schema.Struct({
      name: Schema.optional(
        Schema.Struct({
          firstName: Schema.optional(Schema.String),
          lastName: Schema.optional(Schema.String),
        }),
      ),
      email: Schema.optional(Schema.String),
    }),
  ),
}).annotate({ identifier: "SocialIdToken", title: "Social identity token" });

export const SignInSocialPayload = Schema.Struct({
  callbackURL: Schema.optional(Schema.String),
  newUserCallbackURL: Schema.optional(Schema.String),
  errorCallbackURL: Schema.optional(Schema.String),
  provider: Schema.String,
  disableRedirect: Schema.optional(Schema.Boolean),
  idToken: Schema.optional(SocialIdToken),
  scopes: Schema.optional(Schema.Array(Schema.String)),
  requestSignUp: Schema.optional(Schema.Boolean),
  loginHint: Schema.optional(Schema.String),
  additionalData: Schema.optional(JsonRecord),
  oauth_query: Schema.optional(Schema.String),
}).annotate({
  identifier: "SignInSocialPayload",
  title: "Social sign-in payload",
});

export const SocialRedirectResponse = Schema.Struct({
  url: Schema.optional(Schema.String),
  redirect: Schema.Boolean,
  token: Schema.optional(Schema.String),
  user: Schema.optional(AuthUser),
  status: Schema.optional(Schema.Boolean),
}).annotate({
  identifier: "SocialRedirectResponse",
  title: "Social redirect response",
});

export const SendVerificationOtpPayload = Schema.Struct({
  email: Schema.String,
  type: Schema.Literals(["sign-in", "email-verification", "forget-password"]),
}).annotate({
  identifier: "SendVerificationOtpPayload",
  title: "Send verification OTP payload",
});

export const VerifyEmailOtpPayload = Schema.Struct({
  email: Schema.String,
  otp: Schema.String,
}).annotate({
  identifier: "VerifyEmailOtpPayload",
  title: "Verify email OTP payload",
});

export const VerifyEmailOtpResponse = Schema.Struct({
  status: Schema.Literal(true),
  token: Schema.NullOr(Schema.String),
  user: AuthUser,
}).annotate({
  identifier: "VerifyEmailOtpResponse",
  title: "Verify email OTP response",
});

export const RequestPasswordResetPayload = Schema.Struct({
  email: Schema.String,
  redirectTo: Schema.optional(Schema.String),
}).annotate({
  identifier: "RequestPasswordResetPayload",
  title: "Request password reset payload",
});

export const RequestPasswordResetResponse = Schema.Struct({
  status: Schema.Boolean,
  message: Schema.String,
}).annotate({
  identifier: "RequestPasswordResetResponse",
  title: "Request password reset response",
});

export const ResetPasswordPayload = Schema.Struct({
  newPassword: Schema.String,
  token: Schema.optional(Schema.String),
}).annotate({
  identifier: "ResetPasswordPayload",
  title: "Reset password payload",
});

export const ChangePasswordPayload = Schema.Struct({
  newPassword: Schema.String,
  currentPassword: Schema.String,
  revokeOtherSessions: Schema.optional(Schema.Boolean),
}).annotate({
  identifier: "ChangePasswordPayload",
  title: "Change password payload",
});

export const ChangePasswordResponse = Schema.Struct({
  token: Schema.optional(Schema.NullOr(Schema.String)),
  user: AuthUser,
}).annotate({
  identifier: "ChangePasswordResponse",
  title: "Change password response",
});

export const LinkedAccount = Schema.Struct({
  id: Schema.String,
  providerId: Schema.String,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
  accountId: Schema.String,
  userId: Schema.String,
  scopes: Schema.Array(Schema.String),
}).annotate({ identifier: "LinkedAccount", title: "Linked account" });

export const LinkSocialPayload = Schema.Struct({
  callbackURL: Schema.optional(Schema.String),
  provider: Schema.String,
  idToken: Schema.optional(
    Schema.Struct({
      token: Schema.String,
      nonce: Schema.optional(Schema.String),
      accessToken: Schema.optional(Schema.String),
      refreshToken: Schema.optional(Schema.String),
      scopes: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
  requestSignUp: Schema.optional(Schema.Boolean),
  scopes: Schema.optional(Schema.Array(Schema.String)),
  errorCallbackURL: Schema.optional(Schema.String),
  disableRedirect: Schema.optional(Schema.Boolean),
  additionalData: Schema.optional(JsonRecord),
}).annotate({ identifier: "LinkSocialPayload", title: "Link social payload" });

export const UnlinkAccountPayload = Schema.Struct({
  providerId: Schema.String,
  accountId: Schema.optional(Schema.String),
}).annotate({
  identifier: "UnlinkAccountPayload",
  title: "Unlink account payload",
});

export const TwoFactorSendPayload = Schema.Struct({
  trustDevice: Schema.optional(Schema.Boolean),
}).annotate({
  identifier: "TwoFactorSendPayload",
  title: "Two-factor send payload",
});

export const TwoFactorVerifyPayload = Schema.Struct({
  code: Schema.String,
  trustDevice: Schema.optional(Schema.Boolean),
  oauth_query: Schema.optional(Schema.String),
}).annotate({
  identifier: "TwoFactorVerifyPayload",
  title: "Two-factor verification payload",
});

export const TwoFactorBackupVerifyPayload = Schema.Struct({
  code: Schema.String,
  disableSession: Schema.optional(Schema.Boolean),
  trustDevice: Schema.optional(Schema.Boolean),
  oauth_query: Schema.optional(Schema.String),
}).annotate({
  identifier: "TwoFactorBackupVerifyPayload",
  title: "Two-factor backup verification payload",
});

export const TwoFactorEnablePayload = Schema.Struct({
  password: Schema.optional(Schema.String),
  issuer: Schema.optional(Schema.String),
}).annotate({
  identifier: "TwoFactorEnablePayload",
  title: "Enable two-factor payload",
});

export const TwoFactorEnableResponse = Schema.Struct({
  totpURI: Schema.String,
  backupCodes: Schema.Array(Schema.String),
}).annotate({
  identifier: "TwoFactorEnableResponse",
  title: "Enable two-factor response",
});

export const TwoFactorDisablePayload = Schema.Struct({
  password: Schema.optional(Schema.String),
}).annotate({
  identifier: "TwoFactorDisablePayload",
  title: "Disable two-factor payload",
});

export const AuthOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(
    Schema.NullOr(Schema.Union([JsonRecord, Schema.String])),
  ),
  userId: Schema.optional(Schema.NullOr(Schema.String)),
  parentId: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.DateFromString,
}).annotate({
  identifier: "AuthOrganization",
  title: "Auth organization",
});

export const AuthMemberRecord = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  userId: Schema.String,
  role: Schema.String,
  createdAt: Schema.DateFromString,
}).annotate({
  identifier: "AuthMemberRecord",
  title: "Organization member record",
});

export const AuthMemberUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({
  identifier: "AuthMemberUser",
  title: "Organization member user",
});

export const AuthMember = Schema.Struct({
  ...AuthMemberRecord.fields,
  user: AuthMemberUser,
}).annotate({ identifier: "AuthMember", title: "Organization member" });

export const AuthInvitation = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: Schema.String,
  organizationId: Schema.String,
  organizationName: Schema.optional(Schema.NullOr(Schema.String)),
  inviterId: Schema.String,
  teamId: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.String,
  expiresAt: Schema.DateFromString,
  createdAt: Schema.optional(Schema.DateFromString),
}).annotate({ identifier: "AuthInvitation", title: "Organization invitation" });

export const FullAuthOrganization = Schema.Struct({
  ...AuthOrganization.fields,
  members: Schema.Array(AuthMember),
  invitations: Schema.Array(AuthInvitation),
}).annotate({
  identifier: "FullAuthOrganization",
  title: "Full auth organization",
});

export const GetFullOrganizationQuery = Schema.Struct({
  organizationId: Schema.optional(Schema.String),
  organizationSlug: Schema.optional(Schema.String),
  membersLimit: Schema.optional(Schema.NumberFromString),
}).annotate({
  identifier: "GetFullOrganizationQuery",
  title: "Get full organization query",
});

export const SetActiveOrganizationPayload = Schema.Struct({
  organizationId: Schema.optional(Schema.NullOr(Schema.String)),
  organizationSlug: Schema.optional(Schema.String),
}).annotate({
  identifier: "SetActiveOrganizationPayload",
  title: "Set active organization payload",
});

export const CreateOrganizationPayload = Schema.Struct({
  name: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(JsonRecord),
  parentId: Schema.optional(Schema.NullOr(Schema.String)),
  keepCurrentActiveOrganization: Schema.optional(Schema.Boolean),
}).annotate({
  identifier: "CreateOrganizationPayload",
  title: "Create organization payload",
});

export const UpdateOrganizationPayload = Schema.Struct({
  organizationId: Schema.optional(Schema.String),
  data: Schema.Struct({
    name: Schema.optional(Schema.NonEmptyString),
    slug: Schema.optional(Schema.NonEmptyString),
    logo: Schema.optional(Schema.NullOr(Schema.String)),
    metadata: Schema.optional(JsonRecord),
    parentId: Schema.optional(Schema.NullOr(Schema.String)),
  }),
}).annotate({
  identifier: "UpdateOrganizationPayload",
  title: "Update organization payload",
});

export const OrganizationListMembersQuery = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
  sortBy: Schema.optional(Schema.String),
  sortDirection: Schema.optional(Schema.Literals(["asc", "desc"])),
  filterField: Schema.optional(Schema.String),
  filterValue: Schema.optional(Schema.String),
  filterOperator: Schema.optional(Schema.String),
  organizationId: Schema.optional(Schema.String),
  organizationSlug: Schema.optional(Schema.String),
}).annotate({
  identifier: "OrganizationListMembersQuery",
  title: "List organization members query",
});

export const OrganizationListMembersResponse = Schema.Struct({
  members: Schema.Array(AuthMember),
  total: Schema.Number,
}).annotate({
  identifier: "OrganizationListMembersResponse",
  title: "List organization members response",
});

export const InviteMemberPayload = Schema.Struct({
  email: Schema.String,
  role: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  organizationId: Schema.optional(Schema.String),
  resend: Schema.optional(Schema.Boolean),
  teamId: Schema.optional(
    Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  ),
}).annotate({
  identifier: "InviteMemberPayload",
  title: "Invite member payload",
});

export const UpdateMemberRolePayload = Schema.Struct({
  role: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  memberId: Schema.String,
  organizationId: Schema.optional(Schema.String),
}).annotate({
  identifier: "UpdateMemberRolePayload",
  title: "Update member role payload",
});

export const RemoveMemberPayload = Schema.Struct({
  memberIdOrEmail: Schema.String,
  organizationId: Schema.optional(Schema.String),
}).annotate({
  identifier: "RemoveMemberPayload",
  title: "Remove member payload",
});

export const LeaveOrganizationPayload = Schema.Struct({
  organizationId: Schema.String,
}).annotate({
  identifier: "LeaveOrganizationPayload",
  title: "Leave organization payload",
});

export const MemberResponse = Schema.Struct({
  member: AuthMemberRecord,
}).annotate({ identifier: "MemberResponse", title: "Member response" });

export const OrganizationInvitationsQuery = Schema.Struct({
  organizationId: Schema.optional(Schema.String),
}).annotate({
  identifier: "OrganizationInvitationsQuery",
  title: "Organization invitations query",
});

export const UserInvitationsQuery = Schema.Struct({}).annotate({
  identifier: "UserInvitationsQuery",
  title: "User invitations query",
});

export const InvitationIdPayload = Schema.Struct({
  invitationId: Schema.String,
}).annotate({
  identifier: "InvitationIdPayload",
  title: "Invitation ID payload",
});

export const GetInvitationQuery = Schema.Struct({ id: Schema.String }).annotate(
  {
    identifier: "GetInvitationQuery",
    title: "Get invitation query",
  },
);

export const GetInvitationResponse = Schema.Struct({
  ...AuthInvitation.fields,
  organizationName: Schema.String,
  organizationSlug: Schema.String,
  inviterEmail: Schema.String,
}).annotate({
  identifier: "GetInvitationResponse",
  title: "Get invitation response",
});

export const InvitationActionResponse = Schema.Struct({
  invitation: Schema.NullOr(AuthInvitation),
  member: Schema.NullOr(AuthMemberRecord),
}).annotate({
  identifier: "InvitationActionResponse",
  title: "Invitation action response",
});

export const OrganizationImpersonateUserPayload = Schema.Struct({
  organizationId: Schema.NonEmptyString,
  actorUserId: Schema.NonEmptyString,
  targetUserId: Schema.NonEmptyString,
  expiresInSeconds: Schema.optional(Schema.Number),
}).annotate({
  identifier: "OrganizationImpersonateUserPayload",
  title: "Organization impersonate user payload",
  description: "Creates an organization-scoped impersonation session.",
});

export const OrganizationImpersonateUserResponse = AuthSessionResponse.annotate(
  {
    identifier: "OrganizationImpersonateUserResponse",
    title: "Organization impersonate user response",
  },
);

export const AuthApiKey = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  start: Schema.NullOr(Schema.String),
  prefix: Schema.NullOr(Schema.String),
  userId: Schema.optional(Schema.String),
  referenceId: Schema.String,
  configId: Schema.String,
  refillInterval: Schema.NullOr(Schema.Number),
  refillAmount: Schema.NullOr(Schema.Number),
  lastRefillAt: Schema.NullOr(Schema.DateFromString),
  enabled: Schema.Boolean,
  rateLimitEnabled: Schema.Boolean,
  rateLimitTimeWindow: Schema.NullOr(Schema.Number),
  rateLimitMax: Schema.NullOr(Schema.Number),
  requestCount: Schema.Number,
  remaining: Schema.NullOr(Schema.Number),
  lastRequest: Schema.NullOr(Schema.DateFromString),
  expiresAt: Schema.NullOr(Schema.DateFromString),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
  metadata: Schema.NullOr(JsonRecord),
  permissions: Schema.optional(Schema.NullOr(StringArrayRecord)),
  referrers: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
}).annotate({ identifier: "AuthApiKey", title: "Auth API key" });

export const ListApiKeysQuery = Schema.Struct({
  configId: Schema.optional(Schema.String),
  organizationId: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
  sortBy: Schema.optional(Schema.String),
  sortDirection: Schema.optional(Schema.Literals(["asc", "desc"])),
}).annotate({ identifier: "ListApiKeysQuery", title: "List API keys query" });

export const ListApiKeysResponse = Schema.Struct({
  apiKeys: Schema.Array(AuthApiKey),
  total: Schema.Number,
  limit: Schema.optional(Schema.NullOr(Schema.Number)),
  offset: Schema.optional(Schema.NullOr(Schema.Number)),
}).annotate({
  identifier: "ListApiKeysResponse",
  title: "List API keys response",
});

export const DeleteApiKeyPayload = Schema.Struct({
  configId: Schema.optional(Schema.String),
  keyId: Schema.String,
}).annotate({
  identifier: "DeleteApiKeyPayload",
  title: "Delete API key payload",
});

export const AdminUserIdPayload = Schema.Struct({
  userId: Schema.String,
}).annotate({
  identifier: "AdminUserIdPayload",
  title: "Admin user ID payload",
});

export const AdminBanUserPayload = Schema.Struct({
  userId: Schema.String,
  banReason: Schema.optional(Schema.String),
  banExpiresIn: Schema.optional(Schema.Number),
}).annotate({ identifier: "AdminBanUserPayload", title: "Ban user payload" });

export const AdminUserResponse = Schema.Struct({ user: AuthUser }).annotate({
  identifier: "AdminUserResponse",
  title: "Admin user response",
});

export const OAuthConsentPayload = Schema.Struct({
  accept: Schema.Boolean,
  scope: Schema.optional(Schema.String),
  oauth_query: Schema.optional(Schema.String),
}).annotate({
  identifier: "OAuthConsentPayload",
  title: "OAuth consent payload",
});

export const OAuthRedirectResponse = Schema.Struct({
  redirect: Schema.Boolean,
  url: Schema.String,
}).annotate({
  identifier: "OAuthRedirectResponse",
  title: "OAuth redirect response",
});

export const OAuthPublicClientQuery = Schema.Struct({
  client_id: Schema.String,
}).annotate({
  identifier: "OAuthPublicClientQuery",
  title: "OAuth public client query",
});

export const OAuthPublicClient = Schema.Struct({
  client_id: Schema.String,
  client_name: Schema.optional(Schema.String),
  client_uri: Schema.optional(Schema.String),
  logo_uri: Schema.optional(Schema.String),
  contacts: Schema.optional(Schema.Array(Schema.String)),
  tos_uri: Schema.optional(Schema.String),
  policy_uri: Schema.optional(Schema.String),
  redirect_uris: Schema.Array(Schema.String),
}).annotate({ identifier: "OAuthPublicClient", title: "OAuth public client" });

export type AuthUser = typeof AuthUser.Type;
export type AuthSession = typeof AuthSession.Type;
export type AuthSessionResponse = typeof AuthSessionResponse.Type;
export type GetSessionResponse = typeof GetSessionResponse.Type;
export type AuthOrganization = typeof AuthOrganization.Type;
export type FullAuthOrganization = typeof FullAuthOrganization.Type;
export type AuthMember = typeof AuthMember.Type;
export type AuthInvitation = typeof AuthInvitation.Type;
export type AuthApiKey = typeof AuthApiKey.Type;
export type LinkedAccount = typeof LinkedAccount.Type;
export type OAuthPublicClient = typeof OAuthPublicClient.Type;
export type OrganizationImpersonateUserPayload =
  typeof OrganizationImpersonateUserPayload.Type;
export type OrganizationImpersonateUserResponse =
  typeof OrganizationImpersonateUserResponse.Type;
