import { m } from "@/paraglide/messages";
import type { AuthEmailKind, AuthEmailSettings } from "./schema";

export const defaultAuthEmailContent = ({
  kind,
  locale,
  appName,
}: {
  kind: AuthEmailKind;
  locale: "en" | "fr";
  appName: string;
}) => {
  const options = { locale };
  const reset = kind === "forget-password" || kind === "reset-password";
  const title = reset
    ? m.reset_password_title({}, options)
    : kind === "sign-in"
      ? m.auth_email_sign_in_title({}, options)
      : kind === "change-email"
        ? m.auth_email_change_email_title({}, options)
        : kind === "two-factor"
          ? m.auth_email_two_factor_title({}, options)
          : m.verify_email_title({}, options);
  const body =
    kind === "reset-password"
      ? m.email_reset_password_description({}, options)
      : m.email_otp_verification_description({}, options);
  const subject =
    kind === "reset-password"
      ? m.email_reset_password_subject({ appName }, options)
      : kind === "forget-password"
        ? m.email_otp_reset_password_subject({ appName }, options)
        : kind === "two-factor"
          ? m.email_two_factor_otp_subject({ appName }, options)
          : kind === "sign-in"
            ? m.auth_email_sign_in_subject({ appName }, options)
            : kind === "change-email"
              ? m.auth_email_change_email_subject({ appName }, options)
              : m.email_otp_verification_subject({ appName }, options);
  return {
    subject,
    preview: body,
    title,
    body,
    footer: "",
    action: m.reset_password_submit({}, options),
  };
};

export const resolveAuthEmailContent = (input: {
  kind: AuthEmailKind;
  locale: "en" | "fr";
  appName: string;
  settings?: AuthEmailSettings | undefined;
}) => {
  const defaults = defaultAuthEmailContent(input);
  const custom = input.settings?.templates?.[input.kind]?.[input.locale];
  const resolve = (key: keyof typeof defaults) =>
    (custom?.[key]?.trim() || defaults[key]).replaceAll(
      "{appName}",
      () => input.appName,
    );
  return {
    subject: resolve("subject").replace(/[\r\n]/g, " "),
    preview: resolve("preview"),
    title: resolve("title"),
    body: resolve("body"),
    footer: resolve("footer"),
    action: resolve("action"),
  };
};
