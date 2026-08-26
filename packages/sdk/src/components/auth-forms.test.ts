import { describe, expect, it } from "@effect/vitest";

import { resolveInitialAuthMethod } from "./auth-forms.js";

describe("resolveInitialAuthMethod", () => {
  it("restores password from the email login method", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: null,
        lastLoginMethod: "email",
        emailPassword: true,
        emailOtp: true,
      }),
    ).toBe("password");
  });

  it("restores the email OTP login method", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: null,
        lastLoginMethod: "email-otp",
        emailPassword: true,
        emailOtp: true,
      }),
    ).toBe("emailOtp");
  });

  it("prefers an available method requested in the URL", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: "emailOtp",
        lastLoginMethod: "email",
        emailPassword: true,
        emailOtp: true,
      }),
    ).toBe("emailOtp");
  });

  it("falls back when the remembered method is disabled", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: null,
        lastLoginMethod: "email",
        emailPassword: false,
        emailOtp: true,
      }),
    ).toBe("emailOtp");
  });
});
