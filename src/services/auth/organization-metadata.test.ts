import { describe, expect, it } from "@effect/vitest";

import { mergeOrganizationMetadata } from "./organization-metadata";

describe("mergeOrganizationMetadata", () => {
  it("preserves fields omitted by a legacy client", () => {
    expect(
      mergeOrganizationMetadata(
        {
          translations: [{ locale: "en", name: "Before" }],
          emails: [{ email: "team@example.com" }],
          billing: { reference: "customer_1" },
        },
        { translations: [{ locale: "en", name: "After" }] },
      ),
    ).toEqual({
      translations: [{ locale: "en", name: "After" }],
      emails: [{ email: "team@example.com" }],
      billing: { reference: "customer_1" },
    });
  });

  it("allows a new client to explicitly clear an array", () => {
    expect(
      mergeOrganizationMetadata(
        { emails: [{ email: "team@example.com" }], billing: "customer_1" },
        { translations: [], emails: [] },
      ),
    ).toEqual({
      translations: [],
      emails: [],
      billing: "customer_1",
    });
  });
});
