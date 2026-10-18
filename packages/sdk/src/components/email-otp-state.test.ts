import { describe, expect, it } from "@effect/vitest";
import { emailOtpSendState } from "./email-otp-state.js";

describe("email OTP send history", () => {
  it("reuses a sent code and retains the cooldown when switching methods", () => {
    expect(emailOtpSendState(1_000, 21_000)).toEqual({
      reusable: true,
      resendSeconds: 40,
    });
  });

  it("allows an explicit resend after the cooldown without expiring the code", () => {
    expect(emailOtpSendState(1_000, 61_000)).toEqual({
      reusable: true,
      resendSeconds: 0,
    });
  });

  it("does not reuse expired codes or another address's missing history", () => {
    expect(emailOtpSendState(1_000, 301_000)).toEqual({
      reusable: false,
      resendSeconds: 0,
    });
    expect(emailOtpSendState(undefined, 21_000)).toEqual({
      reusable: false,
      resendSeconds: 0,
    });
  });
});
