import { Effect, Layer } from "effect";
import { NotificationService } from "@krak-stack/registry/service-notification";
import { NotificationChannelRegistry } from "@krak-stack/registry/service-notification/channels";
import { SesNotificationChannel } from "@krak-stack/registry/notification-channel-email-ses";

const sesNotificationRegistryLayer = Layer.effect(
  NotificationChannelRegistry,
  Effect.map(SesNotificationChannel, (channel) =>
    NotificationChannelRegistry.make(channel),
  ),
).pipe(Layer.provide(SesNotificationChannel.layer));

const sesNotificationLayer = NotificationService.layer.pipe(
  Layer.provide(sesNotificationRegistryLayer),
);

export const notificationLayer =
  process.env.NODE_ENV === "test"
    ? NotificationService.noopLayer
    : process.env.NODE_ENV === "development"
      ? NotificationService.localLayer
      : sesNotificationLayer;
