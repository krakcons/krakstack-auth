import { Button, Container } from "@react-email/components";

import { m } from "@/paraglide/messages";

import { BaseEmail } from "./BaseEmail";
import type { EmailTheme } from "./Tailwind";
import type { AuthEmailAppearance } from "@/services/auth-emails/schema";

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
      action: (
        <Container>
          <Button
            className="bg-primary text-primary-foreground rounded-md px-4 py-3 align-middle font-medium"
            href={url}
          >
            {action}
          </Button>
        </Container>
      ),
    }}
  />
);

export default ResetPasswordEmail;
