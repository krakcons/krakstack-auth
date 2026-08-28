import type { ProjectAccessLabelCatalog } from "@krak-stack/auth/components";

import { m } from "@/paraglide/messages";

export const authAccessLabels = (): ProjectAccessLabelCatalog => ({
  project: m.auth_access_project(),
  roles: {},
  permissions: {
    projects: {
      label: m.auth_access_projects(),
      actions: {
        read: m.auth_access_action_read(),
        create: m.auth_access_action_create(),
        update: m.auth_access_action_update(),
        delete: m.auth_access_action_delete(),
      },
    },
    users: {
      label: m.auth_access_users(),
      actions: {
        read: m.auth_access_action_read(),
        invite: m.auth_access_action_invite(),
        update: m.auth_access_action_update(),
      },
    },
    billing: {
      label: m.auth_access_billing(),
      actions: {
        read: m.auth_access_action_read(),
        manage: m.auth_access_action_manage(),
      },
    },
  },
});
