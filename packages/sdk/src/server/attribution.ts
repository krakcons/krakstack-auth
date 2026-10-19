import { Effect, Option, References } from "effect";

/** Replace auth-owned attribution rather than merging it with an outer actor. */
export const withAuthAnnotations = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  attributes: Readonly<Record<string, string | ReadonlyArray<string>>>,
) => {
  const ownedAttribute = (key: string) =>
    key.startsWith("user.") ||
    key.startsWith("app.user.") ||
    key === "organization.id" ||
    key.startsWith("app.actor.") ||
    key.startsWith("app.auth.");
  const replaceAttribution = (
    annotations: Effect.Success<typeof References.CurrentLogAnnotations>,
  ) => ({
    ...Object.fromEntries(
      Object.entries(annotations).filter(([key]) => !ownedAttribute(key)),
    ),
    ...attributes,
  });
  return Effect.gen(function* () {
    const logs = yield* References.CurrentLogAnnotations;
    const spans = yield* References.TracerSpanAnnotations;
    const current = yield* Effect.currentSpan.pipe(Effect.option);
    if (Option.isSome(current)) {
      for (const key of current.value.attributes.keys()) {
        if (ownedAttribute(key) && attributes[key] === undefined) {
          // Tracer has no removeAttribute API; clear stale current-span values.
          current.value.attribute(key, "");
        }
      }
    }
    yield* Effect.annotateCurrentSpan(attributes);
    return yield* effect.pipe(
      Effect.provideService(
        References.TracerSpanAnnotations,
        replaceAttribution(spans),
      ),
      Effect.provideService(
        References.CurrentLogAnnotations,
        replaceAttribution(logs),
      ),
    );
  });
};
