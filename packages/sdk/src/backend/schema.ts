import { Schema } from "effect";

import { Organization, User } from "../schema";

export const BackendIdsQuery = Schema.Struct({
  ids: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendIdsQuery",
  title: "Backend IDs query",
  description: "Comma-separated resource IDs used to return backend records.",
  examples: [{ ids: "user_1,user_2,user_3" }],
});

export const BackendIdParams = Schema.Struct({
  id: Schema.NonEmptyString,
}).annotate({
  identifier: "BackendIdParams",
  title: "Backend ID params",
  description: "Resource ID used to return a backend record.",
  examples: [{ id: "user_1" }],
});

export const BackendUsersResponse = Schema.Struct({
  data: Schema.Array(User),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendUsersResponse",
  title: "Backend users response",
  description:
    "Batch user response with records and requested IDs that were not found.",
});

export const BackendOrganizationsResponse = Schema.Struct({
  data: Schema.Array(Organization),
  missingIds: Schema.Array(Schema.String),
}).annotate({
  identifier: "BackendOrganizationsResponse",
  title: "Backend organizations response",
  description:
    "Batch organization response with records and requested IDs that were not found.",
});

export type BackendUsersResponse = typeof BackendUsersResponse.Type;
export type BackendOrganizationsResponse =
  typeof BackendOrganizationsResponse.Type;
