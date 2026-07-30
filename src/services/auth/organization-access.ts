import {
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { organizationRoles } from "@krak-stack/auth/roles";

export const organizationAuthRoles = Object.fromEntries(
  organizationRoles.map((role) => [
    role,
    role === "owner" ? ownerAc : role === "admin" ? adminAc : memberAc,
  ]),
);
