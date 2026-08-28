import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  AdminBanUserPayload,
  AdminUserIdPayload,
  AdminUserResponse,
  AuthBadRequest,
  AuthConflict,
  AuthExpectationFailed,
  AuthForbidden,
  AuthInternalServerError,
  AuthInvitation,
  AuthNotFound,
  AuthOrganization,
  AuthSessionResponse,
  AuthStatusResponse,
  AuthSuccessResponse,
  AuthTooManyRequests,
  AuthUnauthorized,
  ChangePasswordPayload,
  ChangePasswordResponse,
  CreateOrganizationPayload,
  DeleteApiKeyPayload,
  FullAuthOrganization,
  GetFullOrganizationQuery,
  GetInvitationQuery,
  GetInvitationResponse,
  GetSessionQuery,
  GetSessionResponse,
  InvitationActionResponse,
  InvitationIdPayload,
  InviteMemberPayload,
  LeaveOrganizationPayload,
  LinkedAccount,
  LinkSocialPayload,
  ListApiKeysQuery,
  ListApiKeysResponse,
  MemberResponse,
  OAuthConsentPayload,
  OAuthPublicClient,
  OAuthPublicClientQuery,
  OAuthRedirectResponse,
  OrganizationImpersonateUserPayload,
  OrganizationImpersonateUserResponse,
  OrganizationInvitationsQuery,
  OrganizationListMembersQuery,
  OrganizationListMembersResponse,
  RemoveMemberPayload,
  RequestPasswordResetPayload,
  RequestPasswordResetResponse,
  ResetPasswordPayload,
  SendVerificationOtpPayload,
  SetActiveOrganizationPayload,
  SignInEmailOtpPayload,
  SignInEmailPayload,
  SignInEmailResponse,
  SignInResponse,
  SignInSocialPayload,
  SocialRedirectResponse,
  TwoFactorBackupVerifyPayload,
  TwoFactorDisablePayload,
  TwoFactorEnablePayload,
  TwoFactorEnableResponse,
  TwoFactorSendPayload,
  TwoFactorVerifyPayload,
  UnlinkAccountPayload,
  UpdateMemberRolePayload,
  UpdateOrganizationPayload,
  UpdateUserPayload,
  UserInvitationsQuery,
  VerifyEmailOtpPayload,
  VerifyEmailOtpResponse,
} from "./schema.js";

export * from "./schema.js";

const errors = [
  AuthBadRequest,
  AuthUnauthorized,
  AuthForbidden,
  AuthNotFound,
  AuthConflict,
  AuthExpectationFailed,
  AuthTooManyRequests,
  AuthInternalServerError,
];

const docs = (title: string, description: string) =>
  OpenApi.annotations({ title, summary: title, description });

export const AuthApiGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("getSession", "/get-session", {
      query: GetSessionQuery.fields,
      success: GetSessionResponse,
      error: errors,
    }).annotateMerge(
      docs("Get session", "Returns the current browser session."),
    ),
  )
  .add(
    HttpApiEndpoint.post("signOut", "/sign-out", {
      success: AuthSuccessResponse,
      error: errors,
    }).annotateMerge(docs("Sign out", "Ends the current browser session.")),
  )
  .add(
    HttpApiEndpoint.post("updateUser", "/update-user", {
      payload: UpdateUserPayload,
      success: AuthStatusResponse,
      error: errors,
    }).annotateMerge(docs("Update user", "Updates the current user profile.")),
  )
  .add(
    HttpApiEndpoint.post("signInEmail", "/sign-in/email", {
      payload: SignInEmailPayload,
      success: SignInEmailResponse,
      error: errors,
    }).annotateMerge(
      docs(
        "Sign in with email",
        "Signs in with an email address and password.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.post("signInEmailOtp", "/sign-in/email-otp", {
      payload: SignInEmailOtpPayload,
      success: SignInResponse,
      error: errors,
    }).annotateMerge(
      docs("Sign in with email OTP", "Signs in with an email one-time code."),
    ),
  )
  .add(
    HttpApiEndpoint.post("signInSocial", "/sign-in/social", {
      payload: SignInSocialPayload,
      success: SocialRedirectResponse,
      error: errors,
    }).annotateMerge(
      docs("Sign in with social provider", "Starts a social sign-in flow."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "sendVerificationOtp",
      "/email-otp/send-verification-otp",
      {
        payload: SendVerificationOtpPayload,
        success: AuthSuccessResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("Send verification OTP", "Sends an email one-time code."),
    ),
  )
  .add(
    HttpApiEndpoint.post("verifyEmailOtp", "/email-otp/verify-email", {
      payload: VerifyEmailOtpPayload,
      success: VerifyEmailOtpResponse,
      error: errors,
    }).annotateMerge(
      docs("Verify email OTP", "Verifies an email with a one-time code."),
    ),
  )
  .add(
    HttpApiEndpoint.post("requestPasswordReset", "/request-password-reset", {
      payload: RequestPasswordResetPayload,
      success: RequestPasswordResetResponse,
      error: errors,
    }).annotateMerge(
      docs("Request password reset", "Sends a password reset link."),
    ),
  )
  .add(
    HttpApiEndpoint.post("resetPassword", "/reset-password", {
      payload: ResetPasswordPayload,
      success: AuthStatusResponse,
      error: errors,
    }).annotateMerge(
      docs("Reset password", "Sets a password using a reset token."),
    ),
  )
  .add(
    HttpApiEndpoint.post("changePassword", "/change-password", {
      payload: ChangePasswordPayload,
      success: ChangePasswordResponse,
      error: errors,
    }).annotateMerge(
      docs("Change password", "Changes the current user's password."),
    ),
  )
  .add(
    HttpApiEndpoint.get("listAccounts", "/list-accounts", {
      success: Schema.Array(LinkedAccount),
      error: errors,
    }).annotateMerge(
      docs("List accounts", "Lists accounts linked to the user."),
    ),
  )
  .add(
    HttpApiEndpoint.post("linkSocial", "/link-social", {
      payload: LinkSocialPayload,
      success: SocialRedirectResponse,
      error: errors,
    }).annotateMerge(
      docs("Link social account", "Links a social provider account."),
    ),
  )
  .add(
    HttpApiEndpoint.post("unlinkAccount", "/unlink-account", {
      payload: UnlinkAccountPayload,
      success: AuthStatusResponse,
      error: errors,
    }).annotateMerge(docs("Unlink account", "Removes a linked account.")),
  )
  .add(
    HttpApiEndpoint.post("twoFactorSendOtp", "/two-factor/send-otp", {
      payload: TwoFactorSendPayload,
      success: AuthStatusResponse,
      error: errors,
    }).annotateMerge(
      docs("Send two-factor OTP", "Sends a two-factor email code."),
    ),
  )
  .add(
    HttpApiEndpoint.post("twoFactorVerifyOtp", "/two-factor/verify-otp", {
      payload: TwoFactorVerifyPayload,
      success: SignInResponse,
      error: errors,
    }).annotateMerge(
      docs("Verify two-factor OTP", "Verifies a two-factor email code."),
    ),
  )
  .add(
    HttpApiEndpoint.post("twoFactorVerifyTotp", "/two-factor/verify-totp", {
      payload: TwoFactorVerifyPayload,
      success: SignInResponse,
      error: errors,
    }).annotateMerge(
      docs("Verify TOTP", "Verifies a time-based one-time code."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "twoFactorVerifyBackupCode",
      "/two-factor/verify-backup-code",
      {
        payload: TwoFactorBackupVerifyPayload,
        success: SignInResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("Verify backup code", "Verifies a two-factor backup code."),
    ),
  )
  .add(
    HttpApiEndpoint.post("twoFactorEnable", "/two-factor/enable", {
      payload: TwoFactorEnablePayload,
      success: TwoFactorEnableResponse,
      error: errors,
    }).annotateMerge(
      docs("Enable two-factor", "Starts two-factor enrollment."),
    ),
  )
  .add(
    HttpApiEndpoint.post("twoFactorDisable", "/two-factor/disable", {
      payload: TwoFactorDisablePayload,
      success: AuthStatusResponse,
      error: errors,
    }).annotateMerge(
      docs("Disable two-factor", "Disables two-factor authentication."),
    ),
  )
  .add(
    HttpApiEndpoint.get("organizationList", "/organization/list", {
      success: Schema.Array(AuthOrganization),
      error: errors,
    }).annotateMerge(
      docs("List organizations", "Lists the user's organizations."),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "organizationGetFull",
      "/organization/get-full-organization",
      {
        query: GetFullOrganizationQuery.fields,
        success: Schema.NullOr(FullAuthOrganization),
        error: errors,
      },
    ).annotateMerge(
      docs(
        "Get full organization",
        "Returns an organization with membership data.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.post("organizationSetActive", "/organization/set-active", {
      payload: SetActiveOrganizationPayload,
      success: Schema.NullOr(AuthOrganization),
      error: errors,
    }).annotateMerge(
      docs(
        "Set active organization",
        "Changes the session's active organization.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.post("organizationCreate", "/organization/create", {
      payload: CreateOrganizationPayload,
      success: AuthOrganization,
      error: errors,
    }).annotateMerge(docs("Create organization", "Creates an organization.")),
  )
  .add(
    HttpApiEndpoint.post("organizationUpdate", "/organization/update", {
      payload: UpdateOrganizationPayload,
      success: AuthOrganization,
      error: errors,
    }).annotateMerge(docs("Update organization", "Updates an organization.")),
  )
  .add(
    HttpApiEndpoint.get(
      "organizationListUserInvitations",
      "/organization/list-user-invitations",
      {
        query: UserInvitationsQuery.fields,
        success: Schema.Array(AuthInvitation),
        error: errors,
      },
    ).annotateMerge(
      docs(
        "List user invitations",
        "Lists organization invitations for the user.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "organizationListMembers",
      "/organization/list-members",
      {
        query: OrganizationListMembersQuery.fields,
        success: OrganizationListMembersResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("List organization members", "Lists members of an organization."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationInviteMember",
      "/organization/invite-member",
      {
        payload: InviteMemberPayload,
        success: AuthInvitation,
        error: errors,
      },
    ).annotateMerge(
      docs("Invite member", "Creates an organization invitation."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationUpdateMemberRole",
      "/organization/update-member-role",
      {
        payload: UpdateMemberRolePayload,
        success: MemberResponse.fields.member,
        error: errors,
      },
    ).annotateMerge(
      docs("Update member role", "Updates an organization member's role."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationRemoveMember",
      "/organization/remove-member",
      {
        payload: RemoveMemberPayload,
        success: MemberResponse,
        error: errors,
      },
    ).annotateMerge(docs("Remove member", "Removes an organization member.")),
  )
  .add(
    HttpApiEndpoint.post("organizationLeave", "/organization/leave", {
      payload: LeaveOrganizationPayload,
      success: MemberResponse.fields.member,
      error: errors,
    }).annotateMerge(
      docs("Leave organization", "Removes the current user's membership."),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "organizationListInvitations",
      "/organization/list-invitations",
      {
        query: OrganizationInvitationsQuery.fields,
        success: Schema.Array(AuthInvitation),
        error: errors,
      },
    ).annotateMerge(
      docs(
        "List organization invitations",
        "Lists invitations for an organization.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "organizationGetInvitation",
      "/organization/get-invitation",
      {
        query: GetInvitationQuery.fields,
        success: GetInvitationResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("Get invitation", "Returns an organization invitation."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationAcceptInvitation",
      "/organization/accept-invitation",
      {
        payload: InvitationIdPayload,
        success: InvitationActionResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("Accept invitation", "Accepts an organization invitation."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationRejectInvitation",
      "/organization/reject-invitation",
      {
        payload: InvitationIdPayload,
        success: InvitationActionResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("Reject invitation", "Rejects an organization invitation."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationCancelInvitation",
      "/organization/cancel-invitation",
      {
        payload: InvitationIdPayload,
        success: AuthInvitation,
        error: errors,
      },
    ).annotateMerge(
      docs("Cancel invitation", "Cancels an organization invitation."),
    ),
  )
  .add(
    HttpApiEndpoint.get("apiKeyList", "/api-key/list", {
      query: ListApiKeysQuery.fields,
      success: ListApiKeysResponse,
      error: errors,
    }).annotateMerge(
      docs("List API keys", "Lists user or organization API keys."),
    ),
  )
  .add(
    HttpApiEndpoint.post("apiKeyDelete", "/api-key/delete", {
      payload: DeleteApiKeyPayload,
      success: AuthSuccessResponse,
      error: errors,
    }).annotateMerge(docs("Delete API key", "Deletes an API key.")),
  )
  .add(
    HttpApiEndpoint.post("adminBanUser", "/admin/ban-user", {
      payload: AdminBanUserPayload,
      success: AdminUserResponse,
      error: errors,
    }).annotateMerge(docs("Ban user", "Bans a user.")),
  )
  .add(
    HttpApiEndpoint.post("adminUnbanUser", "/admin/unban-user", {
      payload: AdminUserIdPayload,
      success: AdminUserResponse,
      error: errors,
    }).annotateMerge(docs("Unban user", "Removes a user ban.")),
  )
  .add(
    HttpApiEndpoint.post("adminImpersonateUser", "/admin/impersonate-user", {
      payload: AdminUserIdPayload,
      success: AuthSessionResponse,
      error: errors,
    }).annotateMerge(
      docs("Impersonate user", "Starts a user impersonation session."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "adminStopImpersonating",
      "/admin/stop-impersonating",
      {
        success: AuthSessionResponse,
        error: errors,
      },
    ).annotateMerge(
      docs("Stop impersonating", "Restores the administrator session."),
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "organizationImpersonateUser",
      "/organization/impersonate-user",
      {
        payload: OrganizationImpersonateUserPayload,
        success: OrganizationImpersonateUserResponse,
        error: errors,
      },
    ).annotateMerge(
      docs(
        "Organization impersonate user",
        "Creates an organization-scoped impersonation session.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.post("oauthConsent", "/oauth2/consent", {
      payload: OAuthConsentPayload,
      success: OAuthRedirectResponse,
      error: errors,
    }).annotateMerge(
      docs(
        "OAuth consent",
        "Accepts or denies an OAuth authorization request.",
      ),
    ),
  )
  .add(
    HttpApiEndpoint.get("oauthPublicClient", "/oauth2/public-client", {
      query: OAuthPublicClientQuery.fields,
      success: OAuthPublicClient,
      error: errors,
    }).annotateMerge(
      docs("Get OAuth public client", "Returns public OAuth client details."),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Authentication",
      description: "Owned browser authentication HTTP contract.",
    }),
  );
