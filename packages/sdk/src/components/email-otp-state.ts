export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_OTP_LIFETIME_MS = 5 * 60 * 1000;

export const emailOtpResendSeconds = (availableAt: number, now: number) =>
  Math.max(0, Math.ceil((availableAt - now) / 1000));

export const shouldSendEmailOtp = ({
  sentAt,
  now,
  resend,
}: {
  sentAt: number | undefined;
  now: number;
  resend: boolean;
}) =>
  sentAt === undefined ||
  now < sentAt ||
  now - sentAt >= EMAIL_OTP_LIFETIME_MS ||
  (resend &&
    emailOtpResendSeconds(
      sentAt + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
      now,
    ) === 0);
