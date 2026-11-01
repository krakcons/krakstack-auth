---
"@krak-stack/auth": patch
---

Add owner-confirmed organization deletion to the organization switcher and validated `organization.deletion_requested` cleanup webhooks, routed through the required `onDeleteOrganization` callback alongside `onDeleteUser`. Account deletion lists blocking organizations without deleting them. Unshared personal organizations are cleaned up with account deletion; standalone deletion remains protected.
