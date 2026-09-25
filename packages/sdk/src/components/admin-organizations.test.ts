import { describe, expect, it } from "@effect/vitest";

import { adminOrganizationsMessages } from "./admin-organizations.js";

describe("adminOrganizationsMessages", () => {
  it("provides component-owned English and French messages", () => {
    expect(adminOrganizationsMessages("en").organization_type_personal).toBe(
      "Personal",
    );
    expect(adminOrganizationsMessages("fr").organization_type_personal).toBe(
      "Personnelle",
    );
  });

  it("applies consumer overrides without requiring Paraglide messages", () => {
    expect(
      adminOrganizationsMessages("en", {
        organization_impersonate_member: "Act as member",
      }).organization_impersonate_member,
    ).toBe("Act as member");
  });
});
