import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as AwsRegion from "@distilled.cloud/aws/Region";
import * as Sesv2 from "@distilled.cloud/aws/sesv2";
import type { EmailPayloadV1 } from "@krak-stack/notifications/transport/email";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { EmailTheme } from "@/emails/Tailwind";
import { assetUrl } from "@/lib/assets";
import { runWithDatabase } from "@/services/database";
import { SqlClient, SqlSchema } from "effect/sql";
import { DomainRow, OrganizationRow, ProjectRow } from "@/db/schema";
import { hostFromRequest } from "@/services/domains";
import { m } from "@/paraglide/messages";
import {
  notificationLayer,
  sendNotificationEmail,
} from "@/services/auth/notification.server";
import { resolveRecipientLocale } from "@/services/auth/locale.server";
import { organizationBranding } from "@/services/organizations/branding";
import {
  AuthEmailSettings,
  type AuthEmailPreviewPayload,
} from "@/services/auth-emails/schema";
import { renderAuthEmail } from "@/services/auth-emails/render";
import type { Project } from "@/services/projects/schema";
import { brandingEmailSender } from "@/services/auth/email-sender";

const fallbackAppName = process.env.AUTH_EMAIL_NAME?.trim() || "Krakstack Auth";
const fallbackFrom =
  process.env.AUTH_EMAIL_FROM?.trim() ||
  process.env.NOTIFICATION_EMAIL_FROM?.trim() ||
  `${fallbackAppName} <no-reply@krakstack.local>`;
// Accept existing mailbox-style environment settings while the transport owns
// quoting and encoding the display name. Use plain Unicode names, not MIME words.
const fallbackMailbox = fallbackFrom.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
const fallbackAddress = fallbackMailbox?.[2]?.trim();
const fallbackDisplayName = fallbackMailbox?.[1]
  ?.trim()
  .replace(/^"(.*)"$/, "$1")
  .replace(/\\(["\\])/g, "$1");
const fallbackSender = {
  from: fallbackAddress ?? fallbackFrom,
  fromName: fallbackDisplayName || undefined,
};
const projectContextCookie = "krakstack-auth.project_context";
const localOtpDirectory =
  process.env.NODE_ENV === "production"
    ? undefined
    : (process.env.AUTH_LOCAL_OTP_DIRECTORY ??
      resolve(tmpdir(), "krakstack-auth-otp"));

const writeLocalOtp = async (email: string, type: string, otp: string) => {
  if (!localOtpDirectory) return;

  await mkdir(localOtpDirectory, { mode: 0o700, recursive: true });
  await writeFile(
    resolve(
      localOtpDirectory,
      `${encodeURIComponent(email.toLowerCase())}.${type}.txt`,
    ),
    otp,
    { mode: 0o600 },
  );
};

const sesConfigured = Boolean(
  process.env.SES_ACCESS_KEY_ID &&
  process.env.SES_SECRET_ACCESS_KEY &&
  process.env.SES_REGION,
);

const emailThemeVariables: ReadonlyArray<readonly [string, keyof EmailTheme]> =
  [
    ["--background", "background"],
    ["--foreground", "foreground"],
    ["--card", "card"],
    ["--primary", "primary"],
    ["--primary-foreground", "primaryForeground"],
    ["--secondary", "secondary"],
    ["--secondary-foreground", "secondaryForeground"],
    ["--muted", "muted"],
    ["--muted-foreground", "mutedForeground"],
    ["--border", "border"],
  ];

const unsafeEmailThemeValue = /[{};@]|url\s*\(|expression\s*\(/i;

const ProjectTheme = Schema.Struct({
  branding: Schema.Struct({ themeCss: Schema.String }),
});

const projectThemeCss = (data: typeof Schema.Unknown.Type) =>
  Option.map(
    Schema.decodeUnknownOption(ProjectTheme)(data),
    (project) => project.branding.themeCss,
  ).pipe(Option.getOrUndefined);

const ProjectEmail = Schema.Struct({ email: AuthEmailSettings }).annotate({
  identifier: "ProjectEmail",
});
const projectEmailSettings = (data: typeof Schema.Unknown.Type) =>
  Schema.decodeUnknownOption(ProjectEmail)(data).pipe(
    Option.map((value) => value.email),
    Option.getOrUndefined,
  );

const emailThemeFromCss = (css: string | undefined) => {
  if (!css?.trim()) return undefined;

  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch?.[1]) return undefined;

  const theme: EmailTheme = {};
  for (const declaration of rootMatch[1].split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) continue;

    const name = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (!value || unsafeEmailThemeValue.test(value)) continue;

    const variable = emailThemeVariables.find(([key]) => key === name);
    if (variable) theme[variable[1]] = value;
  }

  return Object.keys(theme).length ? theme : undefined;
};

const SesLive = Layer.mergeAll(
  FetchHttpClient.layer,
  AwsCredentials.fromCredentials(
    {
      accessKeyId: Redacted.make(process.env.SES_ACCESS_KEY_ID ?? ""),
      secretAccessKey: Redacted.make(process.env.SES_SECRET_ACCESS_KEY ?? ""),
    },
    process.env.SES_REGION ?? "ca-central-1",
  ),
  Layer.succeed(
    AwsRegion.Region,
    Effect.succeed(process.env.SES_REGION ?? "ca-central-1"),
  ),
);

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

const firstForwardedValue = (value: string | null) =>
  value?.split(",")[0]?.trim() || null;

const cookieValue = (headers: Headers, name: string) => {
  const cookie = headers.get("cookie");
  if (!cookie) return null;

  return (
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
};

const decodeCookieValue = (value: string | null) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const originFromRequest = (request: Request | undefined) => {
  if (!request) return undefined;
  const host = hostFromRequest(request);
  if (!host) return undefined;
  const protocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ??
    new URL(request.url).protocol.replace(":", "");

  return `${protocol}://${host}`;
};

const resolveEmailIdentity = async (
  request: Request | undefined,
  locale: "en" | "fr",
) => {
  const fallback = {
    appName: fallbackAppName,
    ...fallbackSender,
    logo: undefined,
    theme: undefined,
    settings: undefined,
  };
  if (!request) return fallback;

  const origin = originFromRequest(request);
  const contextProjectId = decodeCookieValue(
    cookieValue(request.headers, projectContextCookie),
  );
  const contextProject = contextProjectId
    ? await runWithDatabase(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const [project] = yield* SqlSchema.findAll({
            Request: Schema.String,
            Result: ProjectRow,
            execute: (id) =>
              sql`SELECT * FROM project WHERE id = ${id} LIMIT 1`,
          })(contextProjectId);
          return project;
        }),
      )
    : null;

  const host = hostFromRequest(request);
  if (!host) {
    return {
      appName: contextProject?.name ?? fallbackAppName,
      ...fallbackSender,
      logo: assetUrl(contextProject?.logo, origin) || undefined,
      theme: emailThemeFromCss(projectThemeCss(contextProject?.data)),
      settings: projectEmailSettings(contextProject?.data),
    };
  }

  const domain = await runWithDatabase(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const [domain] = yield* SqlSchema.findAll({
        Request: Schema.String,
        Result: DomainRow,
        execute: (host) =>
          sql`SELECT * FROM domains WHERE hostname = ${host} AND active = true LIMIT 1`,
      })(host);
      return domain;
    }),
  );
  if (!domain) {
    return {
      appName: contextProject?.name ?? fallbackAppName,
      ...fallbackSender,
      logo: assetUrl(contextProject?.logo, origin) || undefined,
      theme: emailThemeFromCss(projectThemeCss(contextProject?.data)),
      settings: projectEmailSettings(contextProject?.data),
    };
  }

  const senderDomain = domain.rootHostname || domain.hostname;
  const verified = await isVerifiedEmailIdentity(senderDomain);

  const [organization, domainProject] = await Promise.all([
    domain.organizationId
      ? runWithDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            const [organization] = yield* SqlSchema.findAll({
              Request: Schema.String,
              Result: OrganizationRow,
              execute: (id) =>
                sql`SELECT * FROM organization WHERE id = ${id} LIMIT 1`,
            })(domain.organizationId!);
            return organization;
          }),
        )
      : Promise.resolve(null),
    domain.projectId
      ? runWithDatabase(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            const [project] = yield* SqlSchema.findAll({
              Request: Schema.String,
              Result: ProjectRow,
              execute: (id) =>
                sql`SELECT * FROM project WHERE id = ${id} LIMIT 1`,
            })(domain.projectId!);
            return project;
          }),
        )
      : Promise.resolve(null),
  ]);
  const project = domainProject ?? contextProject;
  const organizationDisplay = organizationBranding(
    organization ?? null,
    locale,
    "logo",
  );
  const appName = organizationDisplay?.name ?? project?.name ?? fallbackAppName;
  const theme = emailThemeFromCss(projectThemeCss(project?.data));
  const logo =
    assetUrl(organizationDisplay?.logo ?? project?.logo, origin) || undefined;

  return {
    appName,
    ...(verified
      ? brandingEmailSender({
          name: appName,
          domain: senderDomain,
          fallbackName: fallbackAppName,
        })
      : fallbackSender),
    logo,
    theme,
    settings: projectEmailSettings(project?.data),
  };
};

const sendAuthEmail = (email: EmailPayloadV1 & { readonly to: string }) =>
  sendNotificationEmail(email).pipe(
    Effect.provide(notificationLayer),
    Effect.runPromise,
  );

export const sendResetPasswordEmail = async ({
  request,
  to,
  url,
}: {
  readonly request?: Request | undefined;
  readonly to: string;
  readonly url: string;
}) => {
  const locale = await runWithDatabase(
    resolveRecipientLocale({ email: to, request }),
  );
  const identity = await resolveEmailIdentity(request, locale);
  await sendAuthEmail({
    from: identity.from,
    fromName: identity.fromName,
    to,
    ...(await Effect.runPromise(
      renderAuthEmail({
        ...identity,
        locale,
        action: { kind: "reset-password", url },
      }),
    )),
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
  const locale = await runWithDatabase(
    resolveRecipientLocale({ email: to, request }),
  );
  const identity = await resolveEmailIdentity(request, locale);
  await sendAuthEmail({
    from: identity.from,
    fromName: identity.fromName,
    to,
    ...(await Effect.runPromise(
      renderAuthEmail({
        ...identity,
        locale,
        action: { kind: "two-factor", otp },
      }),
    )),
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
    "sign-in" | "email-verification" | "forget-password" | "change-email";
}) => {
  await writeLocalOtp(to, type, otp);
  const locale = await runWithDatabase(
    resolveRecipientLocale({ email: to, request }),
  );
  const identity = await resolveEmailIdentity(request, locale);
  await sendAuthEmail({
    from: identity.from,
    fromName: identity.fromName,
    to,
    ...(await Effect.runPromise(
      renderAuthEmail({ ...identity, locale, action: { kind: type, otp } }),
    )),
  });
};

export const previewProjectAuthEmail = ({
  project,
  payload,
  origin,
}: {
  project: Project;
  payload: AuthEmailPreviewPayload;
  origin: string;
}) =>
  renderAuthEmail({
    appName: project.name,
    logo: assetUrl(project.logo, origin),
    theme: emailThemeFromCss(project.data.branding?.themeCss),
    settings: payload.settings,
    locale: payload.locale,
    notice: m.auth_email_test_notice({}, { locale: payload.locale }),
    // Samples never create or persist authentication credentials.
    action:
      payload.kind === "reset-password"
        ? {
            kind: "reset-password",
            url: "https://example.invalid/reset-password",
          }
        : { kind: payload.kind, otp: "000000" },
  });

export const sendProjectAuthEmailTest = Effect.fn("AuthEmails.sendTest")(
  function* ({
    to,
    email,
    locale,
  }: {
    to: string;
    email: { subject: string; html: string; text: string };
    locale: "en" | "fr";
  }) {
    yield* sendNotificationEmail({
      ...email,
      ...fallbackSender,
      to,
      subject: `${m.auth_email_test_prefix({}, { locale })} ${email.subject}`,
    });
  },
);
