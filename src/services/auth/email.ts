import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as AwsRegion from "@distilled.cloud/aws/Region";
import * as Sesv2 from "@distilled.cloud/aws/sesv2";
import { Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import { db } from "@/services/database";
import { hostFromRequest } from "@/services/domains";
import { m } from "@/paraglide/messages";
import { NotificationService } from "@/services/notification";
import { sesNotificationServiceLayer } from "@/services/notification/channels/ses";
import { testNotificationServiceLayer } from "@/services/notification/channels/test";
import type { SesEmailNotification } from "@/services/notification/channels/ses/schema";

const notificationLayer =
  process.env.NODE_ENV === "test"
    ? NotificationService.noopLayer
    : process.env.NODE_ENV === "development"
      ? testNotificationServiceLayer
      : sesNotificationServiceLayer;

const fallbackAppName = process.env.AUTH_EMAIL_NAME ?? "Krakstack Auth";
const fallbackFrom =
  process.env.AUTH_EMAIL_FROM ??
  process.env.NOTIFICATION_EMAIL_FROM ??
  `${fallbackAppName} <no-reply@krakstack.local>`;

const sesConfigured = Boolean(
  process.env.SES_ACCESS_KEY_ID &&
  process.env.SES_SECRET_ACCESS_KEY &&
  process.env.SES_REGION,
);

const SesLive = Layer.mergeAll(
  FetchHttpClient.layer,
  AwsCredentials.fromCredentials({
    accessKeyId: process.env.SES_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY ?? "",
  }),
  Layer.succeed(
    AwsRegion.Region,
    Effect.succeed(process.env.SES_REGION ?? "ca-central-1"),
  ),
);

const sanitizeDisplayName = (value: string) =>
  value.replace(/[\r\n"<>]/g, "").trim() || fallbackAppName;

const fromAddress = (name: string, domain: string) =>
  `${sanitizeDisplayName(name)} <noreply@${domain}>`;

const isUsableEmailDomain = (domain: string) =>
  domain.includes(".") && !domain.includes(":") && domain !== "localhost";

const isVerifiedEmailIdentity = (domain: string) => {
  if (!sesConfigured || !isUsableEmailDomain(domain))
    return Promise.resolve(false);

  return Effect.runPromise(
    Sesv2.getEmailIdentity({ EmailIdentity: domain }).pipe(
      Effect.map(
        (response) =>
          response.VerificationStatus === "SUCCESS" &&
          response.MailFromAttributes?.MailFromDomainStatus === "SUCCESS",
      ),
      Effect.catch((error) => {
        if (error instanceof Sesv2.NotFoundException) {
          return Effect.succeed(false);
        }

        console.error(`Failed to verify SES identity ${domain}:`, error);
        return Effect.succeed(false);
      }),
      Effect.provide(SesLive),
    ),
  );
};

const resolveEmailIdentity = async (request?: Request | undefined) => {
  const fallback = { appName: fallbackAppName, from: fallbackFrom };
  if (!request || !sesConfigured) return fallback;

  const host = hostFromRequest(request);
  if (!host) return fallback;

  const domain = await db.query.domains.findFirst({
    where: { hostname: host, active: true },
  });
  if (!domain) return fallback;

  const senderDomain = domain.rootHostname || domain.hostname;
  const verified = await isVerifiedEmailIdentity(senderDomain);
  if (!verified) return fallback;

  const [organization, project] = await Promise.all([
    domain.organizationId
      ? db.query.organization.findFirst({
          where: { id: domain.organizationId },
        })
      : Promise.resolve(null),
    domain.projectId
      ? db.query.project.findFirst({ where: { id: domain.projectId } })
      : Promise.resolve(null),
  ]);
  const appName = organization?.name ?? project?.name ?? fallbackAppName;

  return { appName, from: fromAddress(appName, senderDomain) };
};

const localeFromRequest = (request?: Request | undefined) => {
  const language = request?.headers.get("accept-language") ?? "";
  return language.toLowerCase().startsWith("fr") ? "fr" : "en";
};

const sendAuthEmail = (email: SesEmailNotification) =>
  Effect.gen(function* () {
    const notifications = yield* NotificationService;
    yield* notifications.send({ email });
  }).pipe(Effect.provide(notificationLayer), Effect.runPromise);

export const sendResetPasswordEmail = async ({
  request,
  to,
  url,
}: {
  readonly request?: Request | undefined;
  readonly to: string;
  readonly url: string;
}) => {
  const locale = localeFromRequest(request);
  const identity = await resolveEmailIdentity(request);
  await sendAuthEmail({
    from: identity.from,
    to,
    subject: m.email_reset_password_subject(
      { appName: identity.appName },
      { locale },
    ),
    text: m.email_reset_password_text({ url }, { locale }),
    html: m.email_reset_password_html({ url }, { locale }),
  });
};

export const sendTwoFactorOtpEmail = async ({
  request,
  to,
  otp,
}: {
  readonly request?: Request | undefined;
  readonly to: string;
  readonly otp: string;
}) => {
  const locale = localeFromRequest(request);
  const identity = await resolveEmailIdentity(request);
  await sendAuthEmail({
    from: identity.from,
    to,
    subject: m.email_two_factor_otp_subject(
      { appName: identity.appName },
      { locale },
    ),
    text: m.email_two_factor_otp_text({ otp }, { locale }),
    html: m.email_two_factor_otp_html({ otp }, { locale }),
  });
};

export const sendEmailVerificationOtpEmail = async ({
  request,
  to,
  otp,
  type,
}: {
  readonly request?: Request | undefined;
  readonly to: string;
  readonly otp: string;
  readonly type:
    | "sign-in"
    | "email-verification"
    | "forget-password"
    | "change-email";
}) => {
  const locale = localeFromRequest(request);
  const identity = await resolveEmailIdentity(request);
  const subject =
    type === "forget-password"
      ? m.email_otp_reset_password_subject(
          { appName: identity.appName },
          { locale },
        )
      : m.email_otp_verification_subject(
          { appName: identity.appName },
          { locale },
        );

  await sendAuthEmail({
    from: identity.from,
    to,
    subject,
    text: m.email_otp_verification_text({ otp }, { locale }),
    html: m.email_otp_verification_html({ otp }, { locale }),
  });
};
