import { describe, expect, it } from "@effect/vitest";

import { organizationPublicProfile } from "./api.builder";

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
});
