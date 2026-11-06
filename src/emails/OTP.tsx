import { Container, Text } from "@react-email/components";

import { m } from "@/paraglide/messages";

import { BaseEmail } from "./BaseEmail";
import type { EmailTheme } from "./Tailwind";
import type {
  AuthEmailAppearance,
  AuthEmailSettings,
} from "@/services/auth-emails/schema";
import { emailTextStyle } from "@/services/auth-emails/typography";

export const OTPEmail = ({
  appName = m.app_name(),
  code = "123456",
  title = m.verify_email_title(),
  description = m.email_otp_verification_description(),
  extra = m.email_otp_expiry(),
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
  readonly code?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
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
        <Container className="bg-muted mx-0 rounded-lg px-4 py-1">
          <Text
            className="text-foreground text-3xl font-bold tracking-widest"
            style={emailTextStyle(typography, "code")}
          >
            {code}
          </Text>
        </Container>
      ),
    }}
  />
);

export default OTPEmail;
