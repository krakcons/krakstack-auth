import { Effect, Redacted, Schema } from "effect";
import { WebhooksReceiver, WebhookVerificationError } from "@krak-stack/registry/webhooks";
import { AccountDeletionData, AccountDeletionWebhook, AuthWebhook } from "../schema.js";
export { AccountDeletionData, AccountDeletionWebhook } from "../schema.js";
export { AuthWebhook, AuthWebhookData } from "../schema.js";

export class AuthWebhookConfigurationError extends Schema.TaggedError<AuthWebhookConfigurationError>()(
  "AuthWebhookConfigurationError",
  {
    message: Schema.String,
  },
) {}
export class AuthWebhookCleanupError extends Schema.TaggedError<AuthWebhookCleanupError>()(
  "AuthWebhookCleanupError",
  {},
) {}
export class UnsupportedAuthWebhook extends Schema.TaggedError<UnsupportedAuthWebhook>()("UnsupportedAuthWebhook", {}) {}

/** Acknowledge only after the app's same-database cleanup has committed. */
export const receiveAuthWebhook = Effect.fn("Auth.receiveAuthWebhook")(
  function* <E, R>(input: {
    readonly projectId: string;
    readonly secret: Redacted.Redacted<string>;
    readonly headers: Readonly<Record<string, string | undefined>>;
    readonly body: string;
    readonly onDeleteUser: (
      data: typeof AccountDeletionData.Type,
    ) => Effect.Effect<void, E, R>;
    readonly onWebhook?: ((webhook: typeof AuthWebhook.Type) => Effect.Effect<void, E, R>) | undefined;
  }) {
    const receiver = yield* WebhooksReceiver;
    return yield* receiver.receive({
      receiver: `krakstack-auth:${input.projectId}`,
      secret: input.secret,
      headers: input.headers,
      body: input.body,
      schema: AuthWebhook.check(
        Schema.makeFilter(
          (payload) => payload.data.projectId === input.projectId,
          { expected: "the configured auth project" },
        ),
      ),
      eventId: ({ event, data }) => `${event}:${data.requestId}`,
      handle: (webhook): Effect.Effect<void, E | WebhookVerificationError | UnsupportedAuthWebhook, R> => {
        if (webhook.event === "user.deletion_requested") return Schema.decodeUnknownEffect(AccountDeletionWebhook)(webhook).pipe(
          Effect.mapError(() => new WebhookVerificationError({ reason: "payload" })),
          Effect.flatMap(({ data }) => input.onDeleteUser(data)),
        );
        return input.onWebhook ? input.onWebhook(webhook) : Effect.fail(new UnsupportedAuthWebhook({}));
      },
    });
  },
);

export const receiveAccountDeletion = <E, R>(input: {
  readonly projectId: string;
  readonly secret: Redacted.Redacted<string>;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: string;
  readonly handle: (data: typeof AccountDeletionData.Type) => Effect.Effect<void, E, R>;
}) => receiveAuthWebhook({ ...input, onDeleteUser: input.handle });
