import { Button, Container } from "@react-email/components";

import { m } from "@/paraglide/messages";

import { BaseEmail } from "./BaseEmail";

export const ResetPasswordEmail = ({
  appName = m.app_name(),
  url = "https://auth.krakstack.com/reset-password?token=preview",
  title = m.reset_password_title(),
  description = m.email_reset_password_description(),
  action = m.reset_password_submit(),
  extra,
  logo,
}: {
  readonly appName?: string | undefined;
  readonly url?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly action?: string | undefined;
  readonly extra?: string | undefined;
  readonly logo?: string | undefined;
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
        <Container className="flex items-center justify-start">
          <Button
            className="bg-primary rounded-md px-4 py-3 align-middle font-medium text-white"
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
