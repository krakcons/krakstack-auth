import { Schema } from "effect";
import {
  AccountDeletionData,
  OrganizationDeletionData,
} from "@krak-stack/auth/schema";

export const deletionEvent = "auth.account.deletion.requested";
export const organizationDeletionEvent = "auth.organization.deletion.requested";
export const personalOrganizationDeletionEvent =
  "auth.personal-organization.deletion.requested";
export const BlockingOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  personal: Schema.Boolean,
}).annotate({ identifier: "BlockingOrganization" });
export const OrganizationDeletionDispatch = Schema.Struct({
  eventId: Schema.String,
  data: OrganizationDeletionData,
}).annotate({ identifier: "OrganizationDeletionDispatch" });
export const PersonalOrganizationDeletion = Schema.Struct({
  userId: Schema.String,
  organizationId: Schema.String,
}).annotate({ identifier: "PersonalOrganizationDeletion" });
export const DeletionActor = Schema.Struct({
  id: Schema.String,
  role: Schema.NullOr(Schema.String),
}).annotate({ identifier: "DeletionActor" });
export const DeletionProject = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
}).annotate({ identifier: "DeletionProject" });
export const DeletionDispatch = Schema.Struct({
  eventId: Schema.String,
  data: AccountDeletionData,
}).annotate({ identifier: "DeletionDispatch" });
export class DeletionEndpointMissing extends Schema.TaggedError<
  DeletionEndpointMissing,
  { readonly brand: unique symbol }
>()("DeletionEndpointMissing", {}) {}
export class DeletionNotCommitted extends Schema.TaggedError<
  DeletionNotCommitted,
  { readonly brand: unique symbol }
>()("DeletionNotCommitted", {}) {}
export class AccountDeletionBlocked extends Schema.TaggedError<
  AccountDeletionBlocked,
  { readonly brand: unique symbol }
>()("AccountDeletionBlocked", {
  reason: Schema.Literals([
    "impersonation",
    "organization_owner",
    "admin_account",
  ]),
}) {}
