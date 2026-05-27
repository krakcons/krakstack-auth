import { Effect, Layer } from "effect";

import { NotificationChannelRegistry } from ".";
import { NotificationService } from "../index";

export const testNotificationChannelLayer = Layer.succeed(
  NotificationChannelRegistry,
  NotificationChannelRegistry.make({
    key: "email",
    send: (payload: unknown) =>
      Effect.sync(() => {
        console.log("[notification:test] email", payload);
      }),
  }),
);

export const testNotificationServiceLayer = NotificationService.layer.pipe(
  Layer.provide(testNotificationChannelLayer),
);
