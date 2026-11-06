import { render } from "@react-email/components";
import { Effect, Schema } from "effect";
import { OTPEmail } from "@/emails/OTP";
import { ResetPasswordEmail } from "@/emails/ResetPassword";
import type { EmailTheme } from "@/emails/Tailwind";
import { m } from "@/paraglide/messages";
import { resolveAuthEmailContent } from "./content";
import type { AuthEmailKind, AuthEmailSettings } from "./schema";
import { sectionPlainText } from "@/emails/EmailSection";

export class AuthEmailRenderError extends Schema.TaggedError<
  AuthEmailRenderError,
  { readonly brand: unique symbol }
>()("AuthEmailRenderError", {}) {}

type EmailAction =
  | { kind: Exclude<AuthEmailKind, "reset-password">; otp: string }
  | { kind: "reset-password"; url: string };

export const renderAuthEmail = Effect.fn("AuthEmails.render")(
  function* (input: {
    action: EmailAction;
    locale: "en" | "fr";
    appName: string;
    logo?: string | null | undefined;
    theme?: EmailTheme | undefined;
    settings?: AuthEmailSettings | undefined;
    notice?: string | undefined;
  }) {
    const content = resolveAuthEmailContent({
      ...input,
      kind: input.action.kind,
    });
    const expiry =
      input.action.kind === "reset-password"
        ? undefined
        : m.email_otp_expiry({}, { locale: input.locale });
    const props = {
      appName: input.appName,
      logo: input.logo ?? null,
      theme: { ...input.theme, ...input.settings?.appearance },
      appearance: input.settings?.appearance,
      locale: input.locale,
      title: content.title,
      description: content.body,
      preview: content.preview,
      footer: content.footer,
      extra: expiry,
      notice: input.notice,
      layout: input.settings?.layout,
      typography: input.settings?.typography,
    };
    const element =
      input.action.kind === "reset-password" ? (
        <ResetPasswordEmail
          {...props}
          url={input.action.url}
          action={content.action}
        />
      ) : (
        <OTPEmail {...props} code={input.action.otp} />
      );
    const html = yield* Effect.tryPromise({
      try: () => render(element),
      catch: () => new AuthEmailRenderError({}),
    });
    const action =
      input.action.kind === "reset-password"
        ? `${content.action}: ${input.action.url}`
        : input.action.otp;
    const text = [
      sectionPlainText(input.settings?.layout?.header, input.locale),
      input.notice,
      content.title,
      content.body,
      action,
      expiry,
      content.footer,
      input.settings?.appearance?.showProjectName !== false
        ? input.appName
        : undefined,
      sectionPlainText(input.settings?.layout?.footer, input.locale),
    ]
      .filter(Boolean)
      .join("\n\n");
    return { subject: content.subject, html, text };
  },
);
