import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  EmailAddress,
  OrganizationEmail,
  Organization,
  OrganizationMetadata,
  WebsiteUrl,
  decodeOrganizationMetadata,
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

  it("decodes valid fields independently from legacy key collisions", () => {
    const metadata = decodeOrganizationMetadata({
      translations: [{ locale: "en", name: "Example" }],
      emails: "legacy custom value",
      phones: [
        {
          number: "+1 514 555 0100",
          translations: [{ locale: "en", label: "Office" }],
        },
      ],
    });

    expect(metadata.emails).toBeUndefined();
    expect(metadata).not.toHaveProperty("emails");
    expect(metadata.phones).toHaveLength(1);
  });

  it("decodes organization responses with legacy metadata collisions", () => {
    const organization = Schema.decodeUnknownSync(Organization)({
      id: "org_1",
      name: "Example",
      slug: "example",
      logo: null,
      metadata: {
        translations: [{ locale: "en", name: "Example" }],
        emails: "legacy custom value",
      },
      parentId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(organization.metadata?.translations).toHaveLength(1);
    expect(organization.metadata?.emails).toBeUndefined();
  });
});
