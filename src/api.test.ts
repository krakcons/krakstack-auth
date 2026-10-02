import { describe, expect, it } from "@effect/vitest";

import { FrontendApi } from "./api";
import { LocaleMiddleware } from "./lib/localization";

describe("FrontendApi", () => {
  it("attaches locale middleware to every frontend application endpoint", () => {
    const groups = Object.values(FrontendApi.groups).filter(
      (group) => group.identifier !== "health",
    );
    expect(groups.length).toBeGreaterThan(0);

    for (const group of groups) {
      const endpoints = Object.values(group.endpoints);
      expect(endpoints.length).toBeGreaterThan(0);

      for (const endpoint of endpoints) {
        expect(
          endpoint.middlewares.has(LocaleMiddleware),
          `${endpoint.method} ${endpoint.path}`,
        ).toBe(true);
      }
    }
  });
});
