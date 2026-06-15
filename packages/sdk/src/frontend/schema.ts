import { Schema } from "effect";

import { Organization } from "../schema";

export const FrontendUserIdParams = Schema.Struct({
  userId: Schema.String,
}).annotate({
  identifier: "FrontendUserIdParams",
  title: "Frontend user ID params",
  description: "Path parameters used to identify a central auth user.",
  examples: [{ userId: "user_1" }],
});

export const FrontendActiveOrganization = Schema.Struct({
  id: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "FrontendActiveOrganization",
  title: "Frontend active organization",
  description:
    "The active organization ID resolved from a user's central auth session.",
  examples: [{ id: "org_1" }],
});

export const FrontendOrganizationsResponse = Schema.Array(
  Organization,
).annotate({
  identifier: "FrontendOrganizationsResponse",
  title: "Frontend organizations response",
  description: "Organizations available to a central auth user.",
});

export const FrontendPresignUploadPayload = Schema.Struct({
  fileName: Schema.NonEmptyString,
  contentType: Schema.NonEmptyString,
}).annotate({
  identifier: "FrontendPresignUploadPayload",
  title: "Frontend presign upload payload",
  description:
    "Payload used to request a presigned organization logo upload URL.",
  examples: [{ fileName: "logo.png", contentType: "image/png" }],
});

export const FrontendPresignedUpload = Schema.Struct({
  uploadUrl: Schema.String,
  url: Schema.String,
}).annotate({
  identifier: "FrontendPresignedUpload",
  title: "Frontend presigned upload",
  description: "Presigned upload URL and stable public asset URL.",
});

export type FrontendActiveOrganization = typeof FrontendActiveOrganization.Type;
export type FrontendOrganizationsResponse =
  typeof FrontendOrganizationsResponse.Type;
export type FrontendPresignUploadPayload =
  typeof FrontendPresignUploadPayload.Type;
export type FrontendPresignedUpload = typeof FrontendPresignedUpload.Type;
