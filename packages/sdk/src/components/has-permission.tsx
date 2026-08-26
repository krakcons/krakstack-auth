import type { ReactNode } from "react";

import { usePermissions } from "./auth-provider.js";

export const useHasPermission = (permission: string) =>
  usePermissions().can(permission);

export const HasPermission = ({
  children,
  permission,
}: {
  children: ReactNode;
  permission: string;
}) => (useHasPermission(permission) ? <>{children}</> : null);
