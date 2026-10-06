import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { UserMetadata } from "@krak-stack/auth/schema";

import { UserRow } from "./schema";

describe("stored user metadata", () => {
  const decode = Schema.decodeUnknownSync(UserRow.fields.metadata);

  it("preserves valid contact groups and drops incompatible ones", () => {
    const phones = [
      {
        number: "+1 514 555 0100",
        translations: [{ locale: "en", label: "Mobile" }],
      },
    ];
    expect(
      decode({
        emails: [{ email: "legacy@example.com", label: "Work" }],
        phones,
      }),
    ).toEqual({ phones });
  });

  it("preserves null and normalizes malformed metadata", () => {
    expect(decode(null)).toBeNull();
    expect(decode({ emails: "legacy" })).toEqual({});
    expect(decode("legacy")).toEqual({});
    expect(decode({ emails: [] })).toEqual({ emails: [] });
  });

  it("keeps new-write validation strict", () => {
    expect(
      Schema.decodeUnknownOption(UserMetadata)({
        emails: [{ email: "legacy@example.com", label: "Work" }],
      })._tag,
    ).toBe("None");
  });
});
