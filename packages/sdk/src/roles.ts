export const organizationRoles = [
  "owner",
  "admin",
  "support",
  "member",
] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const organizationImpersonationRoles = [
  "owner",
  "admin",
  "support",
] as const satisfies readonly OrganizationRole[];

export const globalAdminRoles = ["admin"] as const;
export type GlobalAdminRole = (typeof globalAdminRoles)[number];

export const parseRoleList = (role: unknown) =>
  typeof role === "string"
    ? role
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export const hasAnyRole = (role: unknown, roles: readonly string[]) => {
  const allowed = new Set(roles);
  return parseRoleList(role).some((item) => allowed.has(item));
};

export const isOrganizationRole = (role: string): role is OrganizationRole =>
  (organizationRoles as readonly string[]).includes(role);

export const normalizeOrganizationRole = (role: unknown): OrganizationRole => {
  const [firstRole] = parseRoleList(role).filter(isOrganizationRole);
  return firstRole ?? "member";
};

export const normalizeOrganizationRoles = (
  role: unknown,
): OrganizationRole[] => {
  const roles = parseRoleList(role).filter(isOrganizationRole);
  return roles.length > 0 ? Array.from(new Set(roles)) : ["member"];
};
