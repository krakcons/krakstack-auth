import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { APIError } from "@better-auth/core/error";
import { Effect, Option, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { AccountDeletions } from "./index";

const DeletionContext = Schema.Struct({
  krakstackAudit: Schema.optional(Schema.Struct({ operationId: Schema.String })),
  session: Schema.optional(Schema.NullOr(Schema.Struct({ session: Schema.Struct({
    impersonatedBy: Schema.optional(Schema.NullOr(Schema.String)),
    impersonatedByOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
  }) }))),
}).annotate({ identifier: "NativeDeletionContext" });

export const nativeDeletionInput = Effect.fn("AccountDeletions.nativeInput")(function* (userId: string) {
  const context = tryGetCurrentAuthEndpointContext();
  const state = Option.getOrUndefined(Schema.decodeUnknownOption(DeletionContext)(context?.context));
  const requestId = state?.krakstackAudit?.operationId ?? (yield* SecureRandom.SecureRandom.use((random) => random.uuidV7()).pipe(Effect.provide(SecureRandom.layerWebCrypto)));
  return { userId, requestId, impersonating: Boolean(state?.session?.session.impersonatedBy || state?.session?.session.impersonatedByOrganizationId) };
});
export const prepareNativeDeletion = (userId: string) => Effect.gen(function* () {
  const service = yield* AccountDeletions;
  yield* service.prepare(yield* nativeDeletionInput(userId));
}).pipe(
  Effect.catchTag("AccountDeletionBlocked", (error) => Effect.fail(new APIError("FORBIDDEN", { message: error.reason, code: "ACCOUNT_DELETION_BLOCKED" }))),
  Effect.mapError((error) => error instanceof APIError ? error : new APIError("INTERNAL_SERVER_ERROR", { message: "ACCOUNT_DELETION_SCHEDULING_FAILED" })),
);
export const captureNativeDeletion = (userId: string) => Effect.gen(function* () {
  const service = yield* AccountDeletions;
  yield* service.capture(yield* nativeDeletionInput(userId));
}).pipe(Effect.mapError(() => new APIError("INTERNAL_SERVER_ERROR", { message: "ACCOUNT_DELETION_SCHEDULING_FAILED" })));
