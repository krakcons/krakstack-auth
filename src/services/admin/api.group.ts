import { AdminApiGroup as SdkAdminApiGroup } from "@krak-stack/auth/admin";

import { AdminAuthMiddleware } from "@/services/auth/middleware";

export const AdminApiGroup = SdkAdminApiGroup.middleware(AdminAuthMiddleware);
