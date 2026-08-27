import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { validateUserMetadataWrite } from "./config";

describe("validateUserMetadataWrite", () => {
  it.effect("accepts omitted, null, and valid user metadata", () =>
    Effect.gen(function* () {
      yield* validateUserMetadataWrite(undefined);
      yield* validateUserMetadataWrite(null);
      yield* validateUserMetadataWrite({
        emails: [
          {
            email: "ada@example.com",
            translations: [{ locale: "en", label: "Work" }],
          },
        ],
      });
    }),
  );

  it.effect("rejects malformed metadata from internal adapter writes", () =>
    Effect.gen(function* () {
      const error = yield* validateUserMetadataWrite({
        emails: Array.from({ length: 9 }, () => ({
          email: "ada@example.com",
          translations: [{ locale: "en", label: "Work" }],
        })),
      }).pipe(Effect.flip);

      expect(error.status).toBe("BAD_REQUEST");
    }),
  );

  it.effect("rejects unknown metadata fields before persistence", () =>
    Effect.gen(function* () {
      const error = yield* validateUserMetadataWrite({
        emails: [
          {
            email: "ada@example.com",
            translations: [{ locale: "en", label: "Work" }],
          },
        ],
        extra: "unexpected",
      }).pipe(Effect.flip);

      expect(error.status).toBe("BAD_REQUEST");
    }),
  );
});
