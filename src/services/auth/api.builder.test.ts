import { describe, expect, it } from "@effect/vitest";

import {
  mergeApiKeyPermissions,
  organizationPublicProfile,
} from "./api.builder";

describe("mergeApiKeyPermissions", () => {
  it("updates selected projects without removing other project grants", () => {
    expect(
      mergeApiKeyPermissions(
        {
          "211-search": ["search:execute"],
          kokobi: ["course:read"],
        },
        { "211-search": ["records:read"] },
      ),
    ).toEqual({
      "211-search": ["records:read"],
      kokobi: ["course:read"],
    });
  });
});

describe("organizationPublicProfile", () => {
  it("returns compatibility email and a formatted structured address", () => {
    const profile = organizationPublicProfile(
      {
        id: "org_1",
        name: "Example",
        slug: "example",
        metadata: {
          translations: [{ locale: "en", name: "Example" }],
          emails: [
            {
              email: "team@example.com",
              translations: [{ locale: "en", label: "General" }],
            },
          ],
          addresses: [
            {
              streetAddress: "123 Example Street",
              locality: "Montreal",
              region: "QC",
              postalCode: "H2X 1Y4",
              country: "Canada",
              translations: [{ locale: "en", label: "Head office" }],
            },
          ],
        },
      },
      { locale: "en", fallbackLocale: "en" },
    );

    expect(profile.contactEmail).toBe("team@example.com");
    expect(profile.addresses[0]?.formatted).toBe(
      "123 Example Street, Montreal QC H2X 1Y4, Canada",
    );
  });

  it("adapts legacy email and location metadata", () => {
    const profile = organizationPublicProfile(
      {
        id: "org_1",
        name: "Example",
        slug: "example",
        metadata: {
          translations: [
            {
              locale: "en",
              name: "Example",
              contactEmail: "team@example.com",
              location: "Montreal, QC",
            },
            {
              locale: "fr",
              name: "Exemple",
              contactEmail: "equipe@example.com",
              location: "Montréal, QC",
            },
          ],
        },
      },
      { locale: "fr", fallbackLocale: "en" },
    );

    expect(profile.displayName).toBe("Exemple");
    expect(profile.contactEmail).toBe("equipe@example.com");
    expect(profile.emails).toEqual([
      {
        email: "equipe@example.com",
        translations: [{ locale: "fr", label: "Courriel" }],
      },
    ]);
    expect(profile.addresses).toEqual([
      {
        formatted: "Montréal, QC",
        translations: [{ locale: "fr", label: "Adresse" }],
      },
    ]);
  });

  it("preserves translations when a reserved metadata key is incompatible", () => {
    const profile = organizationPublicProfile(
      {
        id: "org_1",
        name: "Example",
        slug: "example",
        metadata: {
          translations: [{ locale: "en", name: "Localized Example" }],
          emails: "legacy custom value",
        },
      },
      { locale: "en", fallbackLocale: "en" },
    );

    expect(profile.displayName).toBe("Localized Example");
    expect(profile.emails).toEqual([]);
  });

  it("selects a compatibility email using the requested locale", () => {
    const profile = organizationPublicProfile(
      {
        id: "org_1",
        name: "Example",
        slug: "example",
        metadata: {
          translations: [
            { locale: "en", name: "Example" },
            { locale: "fr", name: "Exemple" },
          ],
          emails: [
            {
              email: "team@example.com",
              translations: [{ locale: "en", label: "Email" }],
            },
            {
              email: "equipe@example.com",
              translations: [{ locale: "fr", label: "Courriel" }],
            },
          ],
        },
      },
      { locale: "fr", fallbackLocale: "en" },
    );

    expect(profile.contactEmail).toBe("equipe@example.com");
  });

  it("does not promote an invalid legacy email into the validated array", () => {
    const profile = organizationPublicProfile(
      {
        id: "org_1",
        name: "Example",
        slug: "example",
        metadata: {
          translations: [
            { locale: "en", name: "Example", contactEmail: "support" },
          ],
        },
      },
      { locale: "en", fallbackLocale: "en" },
    );

    expect(profile.contactEmail).toBe("support");
    expect(profile.emails).toEqual([]);
  });
});
