import { Schema } from "effect";

export const OrganizationImpersonationBody = Schema.Struct({
  organizationId: Schema.NonEmptyString,
  actorUserId: Schema.NonEmptyString,
  targetUserId: Schema.NonEmptyString,
  expiresInSeconds: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isGreaterThan(0),
      Schema.isLessThanOrEqualTo(60 * 60 * 24),
    ),
  ),
}).annotate({ identifier: "OrganizationImpersonationBody" });

export const OrganizationImpersonationBodyStandard = Schema.toStandardSchemaV1(
  OrganizationImpersonationBody,
);
