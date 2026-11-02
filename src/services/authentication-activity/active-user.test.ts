import { describe, expect, it } from "@effect/vitest";
import { Events } from "@krak-stack/registry/events";
import { EventsPersistenceError } from "@krak-stack/registry/events/schema";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { TestClock } from "effect/testing";
import { makeTrackActiveUser } from "./active-user";

const session = {
  user: { id: "user-a" },
  session: { userId: "user-a", expiresAt: new Date("2100-01-01T00:00:00Z") },
};
const config = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    VITE_KRAKSTACK_AUTH_ORGANIZATION_ID: "activity-cache-test",
  }),
);

describe("Active user cache", () => {
  it.effect(
    "shares concurrent writes and skips repeats without mixing projects or users",
    () => {
      let writes = 0;
      return Effect.gen(function* () {
        const track = yield* makeTrackActiveUser();
        yield* Effect.all(
          Array.from({ length: 20 }, () => track(session, "project-a")),
          { concurrency: "unbounded" },
        );
        yield* track(session, "project-a");
        expect(writes).toBe(1);
        yield* track(session, "project-b");
        yield* track(
          {
            user: { id: "user-b" },
            session: { ...session.session, userId: "user-b" },
          },
          "project-a",
        );
        expect(writes).toBe(3);
      }).pipe(
        Effect.provide(config),
        Effect.provide(
          Layer.mock(Events, {
            track: () =>
              Effect.gen(function* () {
                writes++;
                yield* Effect.yieldNow;
                return { eventId: "test", inserted: true };
              }),
          }),
        ),
      );
    },
  );

  it.effect("records again at the next UTC day even within the TTL", () => {
    let writes = 0;
    return Effect.gen(function* () {
      yield* TestClock.setTime(Date.UTC(2026, 9, 8, 23, 59));
      const track = yield* makeTrackActiveUser();
      yield* track(session, "project-a");
      yield* TestClock.adjust("2 minutes");
      yield* track(session, "project-a");
      expect(writes).toBe(2);
    }).pipe(
      Effect.provide(config),
      Effect.provide(
        Layer.mock(Events, {
          track: () =>
            Effect.sync(() => {
              writes++;
              return { eventId: "test", inserted: true };
            }),
        }),
      ),
    );
  });

  it.effect("does not cache failed writes", () => {
    let writes = 0;
    return Effect.gen(function* () {
      const track = yield* makeTrackActiveUser();
      expect(
        Exit.isFailure(yield* Effect.exit(track(session, "project-a"))),
      ).toBe(true);
      yield* track(session, "project-a");
      yield* track(session, "project-a");
      expect(writes).toBe(2);
    }).pipe(
      Effect.provide(config),
      Effect.provide(
        Layer.mock(Events, {
          track: () =>
            Effect.gen(function* () {
              writes++;
              if (writes === 1)
                return yield* new EventsPersistenceError({
                  operation: "persist",
                });
              return { eventId: "test", inserted: true };
            }),
        }),
      ),
    );
  });

  it.effect("evicts entries when the capacity is reached", () => {
    let writes = 0;
    return Effect.gen(function* () {
      const track = yield* makeTrackActiveUser(1);
      yield* track(session, "project-a");
      yield* track(session, "project-b");
      yield* track(session, "project-a");
      expect(writes).toBe(3);
    }).pipe(
      Effect.provide(config),
      Effect.provide(
        Layer.mock(Events, {
          track: () =>
            Effect.sync(() => {
              writes++;
              return { eventId: "test", inserted: true };
            }),
        }),
      ),
    );
  });
});
