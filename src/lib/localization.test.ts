import { describe, expect, it } from "@effect/vitest";

import { localize } from "./localization";

describe("localize", () => {
  it("returns the requested locale when no translation is available", () => {
    expect(
      localize(
        { locale: "fr", fallbackLocale: "none" },
        { id: "organization-1", translations: [] },
      ),
    ).toEqual({ id: "organization-1", locale: "fr" });
  });
});
