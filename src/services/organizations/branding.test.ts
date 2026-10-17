import { describe, expect, it } from "@effect/vitest";

import { organizationBranding } from "./branding";

describe("organizationBranding", () => {
  const organization = {
    name: "Organization",
    logo: "/default-logo.png",
    metadata: {
      translations: [
        {
          locale: "en",
          name: "Organization",
          logo: "/en-logo.png",
          icon: "/en-icon.png",
        },
        {
          locale: "fr",
          name: "Organisation",
          logo: "/fr-logo.png",
          icon: "/fr-icon.png",
        },
      ],
    },
  };

  it("selects localized logos rather than icons for email branding", () => {
    expect(organizationBranding(organization, "en", "logo")?.logo).toBe(
      "/en-logo.png",
    );
    expect(organizationBranding(organization, "fr", "logo")?.logo).toBe(
      "/fr-logo.png",
    );
  });

  it("falls back to the organization logo, not the localized icon", () => {
    expect(
      organizationBranding(
        {
          ...organization,
          metadata: {
            translations: [
              { locale: "en", name: "Organization", icon: "/en-icon.png" },
            ],
          },
        },
        "en",
        "logo",
      )?.logo,
    ).toBe("/default-logo.png");
  });

  it("preserves icon preference for existing callers", () => {
    expect(organizationBranding(organization, "en")?.logo).toBe("/en-icon.png");
  });
});
