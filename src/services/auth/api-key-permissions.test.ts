import { describe, expect, it } from "@effect/vitest";

import { serviceApiKeyAllowsProxy } from "./api-key-permissions";

describe("service API key proxy permissions", () => {
  it("defaults unconfigured service keys to all projects", () => {
    for (const permissions of [undefined, null, {}]) {
      expect(serviceApiKeyAllowsProxy(permissions, "project-one")).toBe(true);
      expect(serviceApiKeyAllowsProxy(permissions, "project-two")).toBe(true);
    }
  });

  it("restricts configured grants to the named projects and actions", () => {
    const grants = {
      "project-one": ["auth:proxy"],
      "project-two": ["courses:read"],
    };
    expect(serviceApiKeyAllowsProxy(grants, "project-one")).toBe(true);
    expect(serviceApiKeyAllowsProxy(grants, "project-two")).toBe(false);
    expect(serviceApiKeyAllowsProxy(grants, "project-three")).toBe(false);
  });

  it("does not treat explicit empty action lists as unrestricted", () => {
    expect(serviceApiKeyAllowsProxy({ "project-one": [] }, "project-one")).toBe(
      false,
    );
    expect(serviceApiKeyAllowsProxy({ "project-one": [] }, "project-two")).toBe(
      false,
    );
  });
});
