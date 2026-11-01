import { Effect } from "effect";
import type { AuthMember, FullAuthOrganization } from "../auth/schema.js";
import { parseRoleList } from "../roles.js";
import { authHttpClient } from "./auth-client-api.js";

export const canDeleteOrganization = (
  organization:
    | (Pick<FullAuthOrganization, "userId"> & {
        readonly members: ReadonlyArray<Pick<AuthMember, "userId" | "role">>;
      })
    | null,
  userId: string | undefined,
) =>
  Boolean(
    organization &&
    !organization.userId &&
    userId &&
    organization.members.some(
      (member) =>
        member.userId === userId &&
        parseRoleList(member.role).includes("owner"),
    ),
  );

export const requestOrganizationDeletion = (
  organizationId: string,
  baseUrl?: string,
) =>
  authHttpClient(baseUrl).pipe(
    Effect.flatMap((client) =>
      client.auth.organizationDelete({ payload: { organizationId } }),
    ),
  );
