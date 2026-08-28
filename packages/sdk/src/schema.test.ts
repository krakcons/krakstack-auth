import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  EmailAddress,
  OrganizationEmail,
  Organization,
  OrganizationMetadata,
  User,
  UserMetadata,
  WebsiteUrl,
  decodeOrganizationMetadata,
  decodeUserMetadata,
} from "./schema.js";

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

describe("user contact schemas", () => {
  it("supports email, phone, website, and social contact methods", () => {
    const metadata = Schema.decodeUnknownSync(UserMetadata)({
      emails: [
        {
          email: "ada@example.com",
          translations: [{ locale: "en", label: "Work" }],
        },
      ],
      phones: [
        {
          number: "+1 514 555 0100",
          extension: "123",
          translations: [{ locale: "en", label: "Mobile" }],
        },
      ],
      websites: [
        {
          url: "https://example.com",
          translations: [{ locale: "fr", label: "Site Web" }],
        },
      ],
      socials: [
        {
          platform: "linkedin",
          url: "https://linkedin.com/in/example",
          translations: [{ locale: "en", label: "LinkedIn" }],
        },
      ],
    });

    expect(metadata.emails).toHaveLength(1);
    expect(metadata.phones?.[0]?.extension).toBe("123");
    expect(metadata.websites?.[0]?.translations[0]?.locale).toBe("fr");
    expect(metadata.socials?.[0]?.platform).toBe("linkedin");
  });

  it("rejects invalid contact values on writes", () => {
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        emails: [
          {
            email: "not-an-email",
            translations: [{ locale: "en", label: "Work" }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        socials: [
          {
            platform: "linkedin",
            url: "linkedin.com/in/example",
            translations: [{ locale: "en", label: "LinkedIn" }],
          },
        ],
      }),
    ).toThrow();
  });

  it("limits contact counts and total metadata size", () => {
    const contacts = [
      [
        "emails",
        {
          email: "ada@example.com",
          translations: [{ locale: "en", label: "Work" }],
        },
      ],
      [
        "phones",
        {
          number: "+1 514 555 0100",
          translations: [{ locale: "en", label: "Mobile" }],
        },
      ],
      [
        "websites",
        {
          url: "https://example.com",
          translations: [{ locale: "en", label: "Website" }],
        },
      ],
      [
        "socials",
        {
          platform: "linkedin",
          url: "https://linkedin.com/in/example",
          translations: [{ locale: "en", label: "LinkedIn" }],
        },
      ],
    ] as const;

    for (const [key, contact] of contacts) {
      expect(
        Schema.decodeUnknownSync(UserMetadata)({
          [key]: Array.from({ length: 8 }, () => contact),
        })[key],
      ).toHaveLength(8);
      expect(() =>
        Schema.decodeUnknownSync(UserMetadata)({
          [key]: Array.from({ length: 9 }, () => contact),
        }),
      ).toThrow();
    }
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        emails: [
          {
            email: "ada@example.com",
            translations: [{ locale: "en", label: "é".repeat(1100) }],
          },
        ],
      }),
    ).toThrow();
    const validLargeMetadata = {
      emails: [
        {
          email: "ada@example.com",
          translations: [{ locale: "en", label: "x".repeat(1500) }],
        },
      ],
    };
    const validLargeMetadataBytes = new TextEncoder().encode(
      JSON.stringify(validLargeMetadata),
    ).byteLength;
    expect(validLargeMetadataBytes).toBeGreaterThan(1024);
    expect(validLargeMetadataBytes).toBeLessThanOrEqual(2048);
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)(validLargeMetadata),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        emails: [
          {
            email: "ada@example.com",
            translations: [{ locale: "en", label: "e".repeat(600) }],
          },
        ],
        phones: [
          {
            number: "+1 514 555 0100",
            translations: [{ locale: "en", label: "p".repeat(600) }],
          },
        ],
        websites: [
          {
            url: "https://example.com",
            translations: [{ locale: "en", label: "w".repeat(600) }],
          },
        ],
        socials: [
          {
            platform: "linkedin",
            url: "https://linkedin.com/in/example",
            translations: [{ locale: "en", label: "s".repeat(600) }],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects invalid phones and platforms", () => {
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        phones: [
          {
            number: "call-me",
            translations: [{ locale: "en", label: "Mobile" }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        phones: [
          {
            number: "-------",
            translations: [{ locale: "en", label: "Mobile" }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(UserMetadata)({
        socials: [
          {
            platform: "myspace",
            url: "https://example.com/profile",
            translations: [{ locale: "en", label: "Social" }],
          },
        ],
      }),
    ).toThrow();
  });

  it("keeps valid sections when another stored section is malformed", () => {
    const metadata = decodeUserMetadata({
      emails: "legacy custom value",
      websites: [
        {
          url: "https://example.com",
          translations: [{ locale: "en", label: "Website" }],
        },
      ],
    });

    expect(metadata.emails).toBeUndefined();
    expect(metadata.websites).toHaveLength(1);
  });

  it("omits stored metadata that exceeds write limits", () => {
    const email = {
      email: "ada@example.com",
      translations: [{ locale: "en", label: "Work" }],
    };

    expect(
      decodeUserMetadata({
        emails: Array.from({ length: 9 }, () => email),
      }),
    ).toEqual({});
    expect(
      decodeUserMetadata({
        emails: [
          {
            ...email,
            translations: [{ locale: "en", label: "é".repeat(1100) }],
          },
        ],
      }),
    ).toEqual({});
  });

  it("decodes metadata on trusted user records", () => {
    const user = Schema.decodeUnknownSync(User)({
      id: "user_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      image: null,
      metadata: {
        socials: [
          {
            platform: "github",
            url: "https://github.com/example",
            translations: [{ locale: "en", label: "GitHub" }],
          },
        ],
      },
      role: null,
      banned: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(user.metadata?.socials?.[0]?.platform).toBe("github");
  });
});
