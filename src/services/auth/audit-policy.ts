// Better Auth 1.7.6's configured HTTP endpoints. Method-specific entries take
// precedence where resource reads and writes share a route template. These are
// library route templates, never a URL/path copied from an incoming request.
const actions = new Map(
  Object.entries({
    "/sign-up/email": "user.registered",
    "/sign-in/email": "session.signed_in",
    "/sign-in/email-otp": "session.signed_in",
    "/sign-in/anonymous": "session.signed_in",
    "/sign-in/social": "session.signed_in",
    "/callback/:id": "session.signed_in",
    "/sign-out": "session.signed_out",
    "/delete-anonymous-user": "user.deleted",
    "/reset-password": "password.reset",
    "/verify-email": "email.verified",
    "/email-otp/verify-email": "email.verified",
    "/email-otp/reset-password": "password.reset",
    "/email-otp/change-email": "user.email_changed",
    "/update-user": "user.updated",
    "/delete-user": "user.deleted",
    "/delete-user/callback": "user.deleted",
    "/change-email": "user.email_changed",
    "/change-password": "user.password_changed",
    "/unlink-account": "account.unlinked",
    "/link-social": "account.linked",
    "/revoke-session": "session.revoked",
    "/revoke-sessions": "session.revoked",
    "/revoke-other-sessions": "session.revoked",
    "/two-factor/enable": "two_factor.enabled",
    "/two-factor/disable": "two_factor.disabled",
    "/two-factor/verify-totp": "session.signed_in",
    "/two-factor/verify-otp": "session.signed_in",
    "/two-factor/verify-backup-code": "session.signed_in",
    "/two-factor/generate-backup-codes": "two_factor.backup_codes_regenerated",
    "/api-key/create": "api_key.created",
    "/api-key/update": "api_key.updated",
    "/api-key/delete": "api_key.deleted",
    "/organization/create": "organization.created",
    "/organization/update": "organization.updated",
    "/organization/delete": "organization.deleted",
    "/organization/invite-member": "invitation.created",
    "/organization/cancel-invitation": "invitation.cancelled",
    "/organization/accept-invitation": "invitation.accepted",
    "/organization/reject-invitation": "invitation.rejected",
    "/organization/remove-member": "membership.removed",
    "/organization/update-member-role": "membership.role_changed",
    "/organization/leave": "membership.left",
    "/organization/impersonate-user": "session.impersonated",
    "/admin/create-user": "user.created",
    "/admin/update-user": "user.updated",
    "/admin/set-role": "user.role_changed",
    "/admin/set-user-password": "user.password_changed",
    "/admin/ban-user": "user.banned",
    "/admin/unban-user": "user.unbanned",
    "/admin/remove-user": "user.deleted",
    "/admin/revoke-user-session": "session.revoked",
    "/admin/revoke-user-sessions": "session.revoked",
    "/admin/impersonate-user": "session.impersonated",
    "/admin/stop-impersonating": "session.impersonation_ended",
    "/oauth2/end-session": "session.signed_out",
    "/oauth2/end-session/confirm": "session.signed_out",
    "/oauth2/register": "oauth_client.created",
    "/admin/oauth2/create-client": "oauth_client.created",
    "/admin/oauth2/update-client": "oauth_client.updated",
    "/oauth2/create-client": "oauth_client.created",
    "/oauth2/update-client": "oauth_client.updated",
    "/oauth2/delete-client": "oauth_client.deleted",
    "/oauth2/client/rotate-secret": "oauth_client.secret_rotated",
    "/oauth2/update-consent": "oauth_consent.updated",
    "/oauth2/delete-consent": "oauth_consent.deleted",
    "POST /admin/oauth2/resources": "oauth_resource.created",
    "PATCH /admin/oauth2/resources/:identifier": "oauth_resource.updated",
    "DELETE /admin/oauth2/resources/:identifier": "oauth_resource.deleted",
    "POST /admin/oauth2/resources/:identifier/clients/:client_id":
      "oauth_resource.client_linked",
    "DELETE /admin/oauth2/resources/:identifier/clients/:client_id":
      "oauth_resource.client_unlinked",
  }),
);

const exclusions = new Map(
  Object.entries({
    "/request-password-reset":
      "Password-reset link request; no password changed.",
    "/send-verification-email":
      "Email-verification request; no verification yet.",
    "/email-otp/send-verification-otp": "OTP delivery preparation.",
    "/email-otp/check-verification-otp":
      "OTP check, not an account/security change.",
    "/email-otp/request-password-reset": "OTP reset preparation.",
    "/forget-password/email-otp":
      "OTP reset preparation (compatibility endpoint).",
    "/email-otp/request-email-change": "Email-change verification preparation.",
    "/two-factor/send-otp": "Two-factor challenge delivery.",
    "/two-factor/get-totp-uri": "Two-factor setup read; no enabled factor yet.",
    "/update-session": "Session metadata/bookkeeping, not a security action.",
    "/organization/set-active":
      "Active-workspace navigation context, not a membership or permission change.",
    "/refresh-token": "Provider-token protocol refresh.",
    "/get-access-token": "Provider-token protocol access.",
    "/token": "Protocol JWT issuance.",
    "/oauth2/authorize": "OAuth authorization-code handoff.",
    "/oauth2/consent":
      "OAuth consent handoff; durable consent changes have their own actions.",
    "/oauth2/continue": "OAuth authorization-flow continuation.",
    "/oauth2/token": "OAuth token protocol exchange/issuance.",
    "/oauth2/revoke":
      "OAuth token protocol revocation; explicit session revocation remains an activity.",
    "/account-info":
      "Provider-profile read; incidental cached-token refresh is not a separate user action.",
    "/get-session":
      "Session lookup/TTL refresh and cookie-cache maintenance; no separate access audit.",
    "/reset-password/:token":
      "Redirect-only reset-link handoff; token is neither consumed nor a credential changed.",
    "/verify-password":
      "Credential check only; no mutation or session issuance.",
    "/list-sessions": "Read-only session list.",
    "/list-accounts": "Read-only account list.",
    "/admin/get-user": "Read-only admin query.",
    "/admin/list-users": "Read-only admin query.",
    "/admin/list-user-sessions": "Read-only POST query.",
    "/admin/has-permission": "Read-only permission check.",
    "/organization/get-organization": "Read-only organization query.",
    "/organization/get-full-organization": "Read-only organization query.",
    "/organization/list": "Read-only organization query.",
    "/organization/get-invitation": "Read-only invitation query.",
    "/organization/list-invitations": "Read-only invitation query.",
    "/organization/get-active-member": "Read-only membership query.",
    "/organization/check-slug": "Read-only availability check.",
    "/organization/list-user-invitations": "Read-only invitation query.",
    "/organization/list-members": "Read-only membership query.",
    "/organization/get-active-member-role": "Read-only membership query.",
    "/organization/has-permission": "Read-only permission check.",
    "/api-key/get": "Read-only key query.",
    "/api-key/list": "Read-only key query.",
    "/oauth2/introspect": "Token introspection; no credential/token issuance.",
    "/oauth2/userinfo": "Read-only user-info query.",
    "/oauth2/public-client-prelogin": "Read-only POST public client query.",
    "/oauth2/get-client": "Read-only client query.",
    "/oauth2/public-client": "Read-only public client query.",
    "/oauth2/get-clients": "Read-only client query.",
    "/oauth2/get-consent": "Read-only consent query.",
    "/oauth2/get-consents": "Read-only consent query.",
    "GET /admin/oauth2/resources": "Read-only resource query.",
    "GET /admin/oauth2/resources/:identifier": "Read-only resource query.",
    "/jwks":
      "Public discovery; lazy key provisioning is internal library maintenance.",
    "/.well-known/oauth-authorization-server": "Public discovery.",
    "/.well-known/openid-configuration": "Public discovery.",
    "/open-api/generate-schema": "API documentation.",
    "/reference": "API documentation.",
    "/ok": "Health check.",
    "/error": "Error presentation.",
  }),
);

// Not exposed by the native HTTP handler. Server-only calls lack a route
// template; their callers must establish attribution at their own boundary.
export const serverOnlyAuditExclusions = new Set([
  "setPassword",
  "signJWT",
  "verifyJWT",
  "createVerificationOTP",
  "getVerificationOTP",
  "generateTOTP",
  "viewBackupCodes",
  "addMember",
  "verifyApiKey",
  "deleteAllExpiredApiKeys",
]);

const configuredAction = (path: string, method: string) =>
  actions.get(`${method} ${path}`) ?? actions.get(path);

export const nativeAuditOperation = configuredAction;

export const nativeAuditExclusion = (path: string, method: string) => {
  return exclusions.get(`${method} ${path}`) ?? exclusions.get(path);
};

// These direct server API calls are implementation steps of app-owned actions
// already audited by Organizations/OAuthClients. Organization creation also
// provisions a personal workspace during registration. The absence of a native
// Request is library context, not a caller-controlled header/body opt-out.
// Native HTTP requests to these same endpoints MUST remain audited.
const appOwnedSteps = new Set([
  "/organization/create",
  "/organization/delete",
  "/admin/oauth2/create-client",
  "/admin/oauth2/update-client",
  "/oauth2/delete-client",
]);

export const nativeAuditDiagnostic = (path: string, nativeRequest: boolean) => {
  if (path === "/account-info") return "provider_profile_read";
  if (exclusions.has(path)) return "excluded_auth_detail";
  if (!nativeRequest && appOwnedSteps.has(path)) return "app_owned_action_step";
  return undefined;
};
