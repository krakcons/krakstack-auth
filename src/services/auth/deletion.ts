import { APIError } from "@better-auth/core/error";
import { Effect } from "effect";
import { AccountDeletions } from "@/services/account-deletion";
import {
  captureNativeDeletion,
  nativeDeletionInput,
} from "@/services/account-deletion/hooks";

// Server rollout gate: an unset or unexpected environment must fail closed.
export const deletionEnabled = (environment = process.env.NODE_ENV) =>
  environment === "development" || environment === "test";

export const assertDeletionEnabled = () => {
  if (!deletionEnabled()) {
    throw new APIError("FORBIDDEN", {
      code: "DELETION_DISABLED",
      message: "Account and organization deletion is disabled",
    });
  }
};

// Central Auth captures durable notifications before Better Auth removes the
// routing relationships; consuming apps own their SQL cleanup callbacks.
export const onDeleteUser = ({ userId }: { readonly userId: string }) =>
  captureNativeDeletion(userId);

export const onDeleteOrganization = Effect.fn("Auth.onDeleteOrganization")(
  function* ({ organizationId }: { readonly organizationId: string }) {
    const service = yield* AccountDeletions;
    const input = yield* nativeDeletionInput(organizationId);
    yield* service.captureOrganization({
      organizationId,
      requestId: input.requestId,
    });
  },
);
