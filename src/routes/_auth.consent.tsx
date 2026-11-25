import { OAuthConsent } from "@krak-stack/auth/components";
import { createFileRoute } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/consent")({
  component: () => (
    <OAuthConsent
      messages={{
        title: m.consent_title(),
        description: ({ clientName, email }) =>
          email
            ? m.consent_description_with_email({ clientName, email })
            : m.consent_description({ clientName }),
        requestedScopes: m.consent_requested_scopes(),
        permissions: {
          "mcp:read": {
            title: m.consent_permission_read(),
          },
          "mcp:write": {
            title: m.consent_permission_write(),
          },
          offline_access: {
            title: m.consent_permission_offline(),
            description: m.consent_permission_offline_description(),
          },
          openid: { title: m.consent_permission_identity() },
          profile: { title: m.consent_permission_profile() },
          email: { title: m.consent_permission_email() },
        },
        allow: m.consent_authorize(),
        deny: m.consent_deny(),
        error: m.consent_error(),
        invalidRequest: m.consent_invalid_request(),
        notice: m.consent_trust_notice(),
      }}
    />
  ),
});
