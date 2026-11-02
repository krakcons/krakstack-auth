import { describe, expect, it } from "@effect/vitest";
import { valuesToCreatePayload, valuesToPayload } from "./form";

const values = {
  name: " Example client ",
  projectId: "other-project",
  redirectUris: "https://example.com/callback",
  scope: ["openid", "email"],
};

describe("OAuth client project assignment", () => {
  it("pins creation and edits to the current project", () => {
    expect(valuesToCreatePayload(values, "current-project")).toMatchObject({
      projectId: "current-project",
      name: "Example client",
      redirectUris: ["https://example.com/callback"],
      scope: "openid email",
    });
    expect(valuesToPayload(values, "current-project").projectId).toBe(
      "current-project",
    );
    expect(
      valuesToCreatePayload({ ...values, projectId: "" }, "current-project")
        .projectId,
    ).toBe("current-project");
  });

  it("preserves project selection in the global view", () => {
    expect(valuesToCreatePayload(values).projectId).toBe("other-project");
    expect(valuesToPayload(values).projectId).toBe("other-project");
    expect(valuesToPayload({ ...values, projectId: "" }).projectId).toBeNull();
  });
});
