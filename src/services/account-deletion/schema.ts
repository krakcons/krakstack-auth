import { Schema } from "effect";
import { AccountDeletionData } from "@krak-stack/auth/schema";

export const deletionEvent = "auth.account.deletion.requested";
export const DeletionActor = Schema.Struct({ id: Schema.String, role: Schema.NullOr(Schema.String) }).annotate({ identifier: "DeletionActor" });
export const DeletionProject = Schema.Struct({ id: Schema.String, name: Schema.String }).annotate({ identifier: "DeletionProject" });
export const DeletionDispatch = Schema.Struct({
  eventId: Schema.String,
  data: AccountDeletionData,
}).annotate({ identifier: "DeletionDispatch" });
export class DeletionEndpointMissing extends Schema.TaggedError<DeletionEndpointMissing>()("DeletionEndpointMissing", {}) {};
export class DeletionNotCommitted extends Schema.TaggedError<DeletionNotCommitted>()("DeletionNotCommitted", {}) {};
export class AccountDeletionBlocked extends Schema.TaggedError<AccountDeletionBlocked>()("AccountDeletionBlocked", {
  reason: Schema.Literals(["impersonation", "organization_owner", "admin_account"]),
}) {};
