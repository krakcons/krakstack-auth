import { OrganizationSwitcher as AuthOrganizationSwitcher } from "@krak-stack/auth/components";
import type { ComponentProps } from "react";

import { m } from "@/paraglide/messages";
import { OrganizationSsoSettingsPanel } from "@/services/auth/sso/client/form";

export const OrganizationSwitcher = (
  props: Omit<ComponentProps<typeof AuthOrganizationSwitcher>, "security">,
) => (
  <AuthOrganizationSwitcher
    {...props}
    security={{
      label: m.organization_security(),
      description: m.organization_security_description(),
      renderContent: (organizationId) => (
        <OrganizationSsoSettingsPanel
          key={organizationId}
          organizationId={organizationId}
        />
      ),
    }}
  />
);
