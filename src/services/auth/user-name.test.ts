import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { defaultUserName, validateUserNameWrite } from "./config";

describe("user names", () => {
  it("defaults blank signup names to the email prefix without replacing real names", () => {
    const user = { id: "user-id", email: "learner@example.com", name: "" };
    expect(defaultUserName(user)).toBe("learner");
    expect(defaultUserName({ ...user, name: " \t\n" })).toBe("learner");
    expect(defaultUserName({ ...user, name: " Ada Lovelace " })).toBe(
      "Ada Lovelace",
    );
    expect(defaultUserName({ ...user, email: "" })).toBe("user-id");
  });

  it.effect(
    "rejects empty and whitespace-only updates and trims real names",
    () =>
      Effect.gen(function* () {
        for (const name of ["", " ", "\t\n", null]) {
          const error = yield* validateUserNameWrite(name).pipe(Effect.flip);
          expect(error.status).toBe("BAD_REQUEST");
        }
        expect(yield* validateUserNameWrite(" Ada Lovelace ")).toBe(
          "Ada Lovelace",
        );
      }),
  );
});
