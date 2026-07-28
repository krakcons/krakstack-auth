import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  EmailAddress,
  OrganizationEmail,
  OrganizationMetadata,
  WebsiteUrl,
} from "./schema";

describe("organization contact schemas", () => {
  it("validates email and website formats", () => {
    expect(() =>
      Schema.decodeUnknownSync(EmailAddress)("not-an-email"),
    ).toThrow();
    expect(() => Schema.decodeUnknownSync(WebsiteUrl)("example.com")).toThrow();
    expect(Schema.decodeUnknownSync(EmailAddress)("team@example.com")).toBe(
      "team@example.com",
    );
  });

  it("requires at least one non-empty localized label", () => {
    expect(() =>
      Schema.decodeUnknownSync(OrganizationEmail)({
        email: "team@example.com",
        translations: [],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OrganizationEmail)({
        email: "team@example.com",
        translations: [{ locale: "en", label: "   " }],
      }),
    ).toThrow();
  });

  it("supports multiple addresses with localized labels", () => {
    const metadata = Schema.decodeUnknownSync(OrganizationMetadata)({
      translations: [{ locale: "en", name: "Example" }],
      addresses: [
        {
          locality: "Montreal",
          translations: [{ locale: "en", label: "Head office" }],
        },
        {
          locality: "Toronto",
          translations: [{ locale: "en", label: "Sales office" }],
        },
      ],
    });

    expect(metadata.addresses).toHaveLength(2);
  });
});
