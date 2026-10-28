import { describe, expect, it } from "@effect/vitest";
import {
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  emailOtpResendSeconds,
  shouldSendEmailOtp,
} from "./email-otp-state.js";

describe("email OTP resend countdown", () => {
  it("starts a fresh cooldown for each OTP step", () => {
    const enteredAt = 21_000;
    const availableAt = enteredAt + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000;

    expect(emailOtpResendSeconds(availableAt, enteredAt)).toBe(60);
    expect(emailOtpResendSeconds(availableAt, enteredAt + 20_000)).toBe(40);
  });

  it("rounds up partial seconds and expires using elapsed time", () => {
    expect(emailOtpResendSeconds(61_000, 60_001)).toBe(1);
    expect(emailOtpResendSeconds(61_000, 61_000)).toBe(0);
    expect(emailOtpResendSeconds(61_000, 90_000)).toBe(0);
    expect(emailOtpResendSeconds(0, 21_000)).toBe(0);
  });
});

describe("email OTP sends within a sign-in attempt", () => {
  it("does not send again when switching methods, even after the cooldown", () => {
    for (const now of [21_000, 61_000, 121_000]) {
      expect(shouldSendEmailOtp({ sentAt: 1_000, now, resend: false })).toBe(
        false,
      );
    }
  });

  it("allows explicit resends only after the cooldown", () => {
    expect(
      shouldSendEmailOtp({ sentAt: 1_000, now: 60_999, resend: true }),
    ).toBe(false);
    expect(
      shouldSendEmailOtp({ sentAt: 1_000, now: 61_000, resend: true }),
    ).toBe(true);
  });

  it("sends for a fresh attempt, another address, or an expired code", () => {
    expect(
      shouldSendEmailOtp({ sentAt: undefined, now: 21_000, resend: false }),
    ).toBe(true);
    expect(
      shouldSendEmailOtp({ sentAt: 1_000, now: 301_000, resend: false }),
    ).toBe(true);
  });
});
