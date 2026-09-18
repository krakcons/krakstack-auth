import { ApiKeyPermissionGrant } from "@krak-stack/auth/access";
import { Schema } from "effect";

export const ApiKeyPermissionsJson = Schema.fromJsonString(
  Schema.NullOr(ApiKeyPermissionGrant),
).annotate({
  identifier: "ApiKeyPermissionsJson",
});
