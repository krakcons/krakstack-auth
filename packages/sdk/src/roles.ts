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

export const parseRoleList = (role: typeof Schema.Unknown.Type) => {
  const decoded = Schema.decodeUnknownOption(Schema.String)(role);
  return Option.isSome(decoded)
    ? decoded.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
};

export const hasAnyRole = (
  role: typeof Schema.Unknown.Type,
  roles: readonly string[],
) => {
  const allowed = new Set(roles);
  return parseRoleList(role).some((item) => allowed.has(item));
};

export const isOrganizationRole = (role: string): role is OrganizationRole =>
  organizationRoles.some((organizationRole) => organizationRole === role);

export const normalizeOrganizationRole = (
  role: typeof Schema.Unknown.Type,
): OrganizationRole => {
  const [firstRole] = parseRoleList(role).filter(isOrganizationRole);
  return firstRole ?? "member";
};

export const normalizeOrganizationRoles = (
  role: typeof Schema.Unknown.Type,
): OrganizationRole[] => {
  const roles = parseRoleList(role).filter(isOrganizationRole);
  return roles.length > 0 ? Array.from(new Set(roles)) : ["member"];
};
import { Option, Schema } from "effect";
