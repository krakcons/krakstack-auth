import { m } from "@/paraglide/messages";

export const auditEventOptions = () => {
  const nativeEvents = [
    { value: "user.registered", label: m.audit_event_user_registered() },
    { value: "user.created", label: m.audit_event_user_created() },
    { value: "user.updated", label: m.audit_event_user_updated() },
    { value: "user.deleted", label: m.audit_event_user_deleted() },
    { value: "user.email_changed", label: m.audit_event_user_email_changed() },
    {
      value: "user.password_changed",
      label: m.audit_event_user_password_changed(),
    },
    { value: "user.role_changed", label: m.audit_event_user_role_changed() },
    { value: "user.banned", label: m.audit_event_user_banned() },
    { value: "user.unbanned", label: m.audit_event_user_unbanned() },
    { value: "session.signed_in", label: m.audit_event_session_signed_in() },
    { value: "session.signed_out", label: m.audit_event_session_signed_out() },
    { value: "session.revoked", label: m.audit_event_session_revoked() },
    {
      value: "session.impersonated",
      label: m.audit_event_session_impersonated(),
    },
    {
      value: "session.impersonation_ended",
      label: m.audit_event_session_impersonation_ended(),
    },
    { value: "password.reset", label: m.audit_event_password_reset() },
    { value: "email.verified", label: m.audit_event_email_verified() },
    { value: "account.linked", label: m.audit_event_account_linked() },
    { value: "account.unlinked", label: m.audit_event_account_unlinked() },
    { value: "two_factor.enabled", label: m.audit_event_two_factor_enabled() },
    {
      value: "two_factor.disabled",
      label: m.audit_event_two_factor_disabled(),
    },
    {
      value: "two_factor.backup_codes_regenerated",
      label: m.audit_event_two_factor_backup_codes_regenerated(),
    },
    { value: "api_key.created", label: m.audit_event_api_key_created() },
    { value: "api_key.updated", label: m.audit_event_api_key_updated() },
    { value: "api_key.deleted", label: m.audit_event_api_key_deleted() },
    {
      value: "organization.created",
      label: m.audit_event_organization_created(),
    },
    {
      value: "organization.updated",
      label: m.audit_event_organization_updated(),
    },
    {
      value: "organization.deleted",
      label: m.audit_event_organization_deleted(),
    },
    { value: "invitation.created", label: m.audit_event_invitation_created() },
    {
      value: "invitation.cancelled",
      label: m.audit_event_invitation_cancelled(),
    },
    {
      value: "invitation.accepted",
      label: m.audit_event_invitation_accepted(),
    },
    {
      value: "invitation.rejected",
      label: m.audit_event_invitation_rejected(),
    },
    { value: "membership.removed", label: m.audit_event_membership_removed() },
    {
      value: "membership.role_changed",
      label: m.audit_event_membership_role_changed(),
    },
    { value: "membership.left", label: m.audit_event_membership_left() },
    {
      value: "oauth_client.created",
      label: m.audit_event_oauth_client_created(),
    },
    {
      value: "oauth_client.updated",
      label: m.audit_event_oauth_client_updated(),
    },
    {
      value: "oauth_client.deleted",
      label: m.audit_event_oauth_client_deleted(),
    },
    {
      value: "oauth_client.secret_rotated",
      label: m.audit_event_oauth_client_secret_rotated(),
    },
    {
      value: "oauth_consent.updated",
      label: m.audit_event_oauth_consent_updated(),
    },
    {
      value: "oauth_consent.deleted",
      label: m.audit_event_oauth_consent_deleted(),
    },
    {
      value: "oauth_resource.created",
      label: m.audit_event_oauth_resource_created(),
    },
    {
      value: "oauth_resource.updated",
      label: m.audit_event_oauth_resource_updated(),
    },
    {
      value: "oauth_resource.deleted",
      label: m.audit_event_oauth_resource_deleted(),
    },
    {
      value: "oauth_resource.client_linked",
      label: m.audit_event_oauth_resource_client_linked(),
    },
    {
      value: "oauth_resource.client_unlinked",
      label: m.audit_event_oauth_resource_client_unlinked(),
    },
  ];
  return [
    {
      value: "organization.created",
      label: m.audit_event_organization_created(),
    },
    {
      value: "organization.updated",
      label: m.audit_event_organization_updated(),
    },
    {
      value: "organization.deleted",
      label: m.audit_event_organization_deleted(),
    },
    { value: "project.created", label: m.audit_event_project_created() },
    { value: "project.updated", label: m.audit_event_project_updated() },
    { value: "project.deleted", label: m.audit_event_project_deleted() },
    { value: "domain.created", label: m.audit_event_domain_created() },
    { value: "domain.updated", label: m.audit_event_domain_updated() },
    { value: "domain.deleted", label: m.audit_event_domain_deleted() },
    {
      value: "domain.status_changed",
      label: m.audit_event_domain_status_changed(),
    },
    { value: "domain.provisioned", label: m.audit_event_domain_provisioned() },
    {
      value: "domain.deprovisioned",
      label: m.audit_event_domain_deprovisioned(),
    },
    {
      value: "oauth_client.created",
      label: m.audit_event_oauth_client_created(),
    },
    {
      value: "oauth_client.updated",
      label: m.audit_event_oauth_client_updated(),
    },
    {
      value: "oauth_client.deleted",
      label: m.audit_event_oauth_client_deleted(),
    },
    {
      value: "oauth_client.project_assigned",
      label: m.audit_event_oauth_client_project_assigned(),
    },
    { value: "api_key.updated", label: m.audit_event_api_key_updated() },
    { value: "api_key.deleted", label: m.audit_event_api_key_deleted() },
    {
      value: "api_key.rate_limit_reset",
      label: m.audit_event_api_key_rate_limit_reset(),
    },
    ...nativeEvents.map(({ value, label }) => ({
      value: `auth.${value}`,
      label: m.audit_event_native_action({ action: label }),
    })),
  ];
};
