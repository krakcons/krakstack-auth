import { describe, expect, it } from "@effect/vitest";

import { restoreProxyAuthOrigin } from "./better-auth-request";

describe("restoreProxyAuthOrigin", () => {
  it("restores the app origin after an upstream proxy replaces forwarded headers", () => {
    const request = restoreProxyAuthOrigin(
      new Request("https://auth.krakstack.net/api/auth/sign-in/social", {
        headers: {
          "x-forwarded-host": "auth.krakstack.net",
          "x-forwarded-proto": "https",
          "x-krakstack-forwarded-host": "template.krakstack.net",
          "x-krakstack-forwarded-proto": "https",
        },
      }),
    );

    expect(request.headers.get("x-forwarded-host")).toBe(
      "template.krakstack.net",
    );
    expect(request.headers.get("x-forwarded-proto")).toBe("https");
    expect(request.headers.has("x-krakstack-forwarded-host")).toBe(false);
    expect(request.headers.has("x-krakstack-forwarded-proto")).toBe(false);
  });

  it("ignores incomplete proxy origin headers", () => {
    const request = new Request(
      "https://auth.krakstack.net/api/auth/get-session",
      { headers: { "x-krakstack-forwarded-host": "attacker.example.com" } },
    );

    expect(restoreProxyAuthOrigin(request)).toBe(request);
  });
});
