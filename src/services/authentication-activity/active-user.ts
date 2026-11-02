import { Events } from "@krak-stack/registry/events";
import { Digest } from "effect/crypto";
import {
  Cache,
  Config,
  Data,
  DateTime,
  Effect,
  Exit,
  References,
} from "effect";
import { AuthenticationActivitySession, activeUserEvent } from "./schema";

class ActiveUserKey extends Data.Class<{
  organizationId: string;
  userId: string;
  projectId: string | null;
  day: string;
}> {}

const persistActiveUser = Effect.fn("AuthenticationActivity.persistActiveUser")(
  function* ({ organizationId, userId, projectId, day }: ActiveUserKey) {
    const digest = yield* Digest.Digest.pipe(
      Effect.provide(Digest.layerWebCrypto),
    );
    const eventId = yield* digest.digestHex(
      Digest.sha256,
      new TextEncoder().encode(
        `${encodeURIComponent(organizationId)}:${day}:${encodeURIComponent(userId)}:${encodeURIComponent(projectId ?? "")}`,
      ),
    );
    const events = yield* Events;
    yield* events
      .track({
        eventId: `auth-user-active:${eventId}`,
        name: activeUserEvent,
        category: "analytics",
        identity: { userId, organizationId },
        properties: { projectId },
      })
      .pipe(Effect.provideService(References.CurrentLogAnnotations, {}));
  },
);

export const makeTrackActiveUser = Effect.fnUntraced(function* (
  capacity = 10_000,
) {
  const cache = yield* Cache.makeWith(persistActiveUser, {
    capacity,
    requireServicesAt: "lookup",
    timeToLive: (exit) => (Exit.isSuccess(exit) ? "24 hours" : 0),
  });
  return Effect.fn("AuthenticationActivity.activeUser")(function* (
    value: typeof AuthenticationActivitySession.Type,
    projectId: string | null,
  ) {
    const { user, session } = value;
    const now = yield* DateTime.now;
    if (
      user.id !== session.userId ||
      user.isAnonymous ||
      session.impersonatedBy ||
      session.impersonatedByOrganizationId ||
      session.expiresAt.getTime() <= DateTime.toEpochMillis(now)
    )
      return;
    const organizationId = yield* Config.String(
      "VITE_KRAKSTACK_AUTH_ORGANIZATION_ID",
    );
    yield* Cache.get(
      cache,
      new ActiveUserKey({
        organizationId,
        userId: user.id,
        projectId,
        day: DateTime.formatIsoDateUtc(now),
      }),
    );
  });
});

export const trackActiveUser = Effect.runSync(makeTrackActiveUser());
