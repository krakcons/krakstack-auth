import { Container, Text } from "@react-email/components";

import { m } from "@/paraglide/messages";

import { BaseEmail } from "./BaseEmail";

export const OTPEmail = ({
  appName = m.app_name(),
  code = "123456",
  title = m.verify_email_title(),
  description = m.email_otp_verification_description(),
  extra,
  logo = "/favicon.ico",
}: {
  readonly appName?: string | undefined;
  readonly code?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly extra?: string | undefined;
  readonly logo?: string | null | undefined;
}) => (
  <BaseEmail
    preview={description}
    content={{
      appName,
      logo,
      title,
      description,
      extra,
      action: (
        <Container className="mx-0 rounded-lg bg-gray-100 px-4 py-1">
          <Text className="text-foreground text-3xl font-bold tracking-widest">
            {code}
          </Text>
        </Container>
      ),
    }}
  />
);

export default OTPEmail;
