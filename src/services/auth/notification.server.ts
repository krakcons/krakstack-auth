import { ConfigProvider, Effect, Layer, Schema } from "effect";
import {
  DirectNotificationDispatcher,
  dispatchDirect,
} from "@krak-stack/notifications/direct";
import { NotificationTransportRegistry } from "@krak-stack/notifications/transport";
import { sesEmailTransportRegistryLayer } from "@krak-stack/notifications/transport/email-ses";
import { EmailPayloadV1 } from "@krak-stack/notifications/transport/email";

const localTransportLayer = NotificationTransportRegistry.layer([
  {
    channel: "email",
    send: (input) =>
      Effect.gen(function* () {
        const payload = yield* Schema.decodeUnknownEffect(EmailPayloadV1)(
          input.payload,
        );
        if (process.env.NODE_ENV === "development") {
          yield* Effect.log({ to: input.recipientAddress, ...payload });
        }
        return { provider: "local", providerMessageId: null };
      }).pipe(Effect.orDie),
  },
]);

export const notificationLayer = DirectNotificationDispatcher.layer.pipe(
  Layer.provide(
    process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development"
      ? localTransportLayer
      : sesEmailTransportRegistryLayer.pipe(
          // Every auth email supplies its sender explicitly. Legacy environment
          // settings may contain "Name <address>", which we split before sending.
          Layer.provide(
            ConfigProvider.layerAdd(
              ConfigProvider.fromUnknown(
                { NOTIFICATION_EMAIL_FROM: "" },
                { preserveEmptyStrings: true },
              ),
              { asPrimary: true },
            ),
          ),
        ),
  ),
);

export const sendNotificationEmail = Effect.fn("AuthEmails.send")(function* ({
  to,
  ...email
}: EmailPayloadV1 & { readonly to: string }) {
  const encoded = yield* Schema.encodeEffect(
    Schema.fromJsonString(EmailPayloadV1),
  )(email);
  const payload = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.Json),
  )(encoded);
  yield* dispatchDirect({
    scope: { recipientUserId: null, organizationId: null, workspaceId: null },
    eventKey: "auth.email",
    eventVersion: 1,
    channel: "email",
    template: null,
    recipientAddress: to,
    recipientName: null,
    payloadVersion: 1,
    payload,
  });
});
