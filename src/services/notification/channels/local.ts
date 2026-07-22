import { Effect, Layer } from "effect";

import { NotificationChannelRegistry } from ".";
import { NotificationService } from "../index";

export const localNotificationChannelLayer = Layer.succeed(
  NotificationChannelRegistry,
  NotificationChannelRegistry.make({
    key: "email",
    send: (payload: unknown) =>
      Effect.sync(() => {
        console.log("[notification:local] email", payload);
      }),
  }),
);

export const localNotificationServiceLayer = NotificationService.layer.pipe(
  Layer.provide(localNotificationChannelLayer),
);
