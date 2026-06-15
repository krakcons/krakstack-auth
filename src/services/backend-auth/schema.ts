import { Schema } from "effect";

import { AuthOrganization, AuthUser } from "@/lib/auth-schema";

export const BackendAuthIdsQuery = Schema.Struct({
  ids: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendAuthIdsQuery",
  title: "Backend auth IDs query",
  description: "Comma-separated resource IDs used to hydrate backend records.",
  examples: [{ ids: "user_1,user_2,user_3" }],
});

export const BackendAuthUsersResponse = Schema.Struct({
  data: Schema.Array(AuthUser),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendAuthUsersResponse",
  title: "Backend auth users response",
  description:
    "Batch user hydration response with records and requested IDs that were not found.",
});

export const BackendAuthOrganizationsResponse = Schema.Struct({
  data: Schema.Array(AuthOrganization),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendAuthOrganizationsResponse",
  title: "Backend auth organizations response",
  description:
    "Batch organization hydration response with records and requested IDs that were not found.",
});

export type BackendAuthUsersResponse = typeof BackendAuthUsersResponse.Type;
export type BackendAuthOrganizationsResponse =
  typeof BackendAuthOrganizationsResponse.Type;
