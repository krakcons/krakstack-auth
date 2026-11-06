import { Button, Container } from "@react-email/components";

import { m } from "@/paraglide/messages";

import { BaseEmail } from "./BaseEmail";
import type { EmailTheme } from "./Tailwind";
import type {
  AuthEmailAppearance,
  AuthEmailSettings,
} from "@/services/auth-emails/schema";
import { emailTextStyle } from "@/services/auth-emails/typography";

export const ResetPasswordEmail = ({
  appName = m.app_name(),
  url = "https://auth.krakstack.com/reset-password?token=preview",
  title = m.reset_password_title(),
  description = m.email_reset_password_description(),
  action = m.reset_password_submit(),
  extra,
  logo = "/favicon.ico",
  theme,
  appearance,
  preview,
  footer,
  locale,
  notice,
  layout,
  typography,
}: {
  readonly appName?: string | undefined;
  readonly url?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly action?: string | undefined;
  readonly extra?: string | undefined;
  readonly logo?: string | null | undefined;
  readonly theme?: EmailTheme | undefined;
  readonly appearance?: AuthEmailAppearance | undefined;
  readonly preview?: string | undefined;
  readonly footer?: string | undefined;
  readonly locale?: "en" | "fr" | undefined;
  readonly notice?: string | undefined;
  readonly layout?: AuthEmailSettings["layout"] | undefined;
  readonly typography?: AuthEmailSettings["typography"] | undefined;
}) => (
  <BaseEmail
    preview={preview ?? description}
    content={{
      appName,
      logo,
      title,
      description,
      extra,
      theme,
      appearance,
      footer,
      locale,
      notice,
      layout,
      typography,
      action: (
        <Container style={{ textAlign: typography?.button?.alignment }}>
          <Button
            className="bg-primary text-primary-foreground rounded-md px-4 py-3 align-middle font-medium"
            href={url}
            style={emailTextStyle(typography, "button")}
          >
            {action}
          </Button>
        </Container>
      ),
    }}
  />
);

export default ResetPasswordEmail;
