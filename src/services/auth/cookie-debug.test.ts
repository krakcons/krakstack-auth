import { describe, expect, it } from "@effect/vitest";

import { parseCookieAttributes } from "@/services/auth/cookie-debug";

describe("auth cookie debug", () => {
  it("reports cookie attributes without the cookie value", () => {
    expect(
      parseCookieAttributes(
        "krakstack-auth.session_token=secret; Path=/; Domain=dev.kokobi.org; HttpOnly; Secure; SameSite=None; Max-Age=300",
      ),
    ).toEqual({
      name: "krakstack-auth.session_token",
      domain: "dev.kokobi.org",
      path: "/",
      sameSite: "None",
      secure: true,
      httpOnly: true,
      maxAge: "300",
      expires: undefined,
    });
  });
});
