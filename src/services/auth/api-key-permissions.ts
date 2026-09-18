import type { ApiKeyPermissionGrant } from "@krak-stack/auth/access";

export const serviceApiKeyAllowsProxy = (
  permissions: ApiKeyPermissionGrant | null | undefined,
  projectId: string,
) =>
  Object.keys(permissions ?? {}).length === 0 ||
  permissions?.[projectId]?.includes("auth:proxy") === true;
