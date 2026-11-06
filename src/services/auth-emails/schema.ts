import { Schema } from "effect";

export const AuthEmailKind = Schema.Literals([
  "sign-in",
  "email-verification",
  "forget-password",
  "change-email",
  "two-factor",
  "reset-password",
]).annotate({ identifier: "AuthEmailKind" });

const shortText = Schema.String.check(Schema.isMaxLength(200));
const singleLine = shortText.check(Schema.isPattern(/^[^\r\n]*$/));
const bodyText = Schema.String.check(Schema.isMaxLength(4000));
const color = Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/));

export const AuthEmailContent = Schema.Struct({
  subject: Schema.optional(singleLine),
  preview: Schema.optional(singleLine),
  title: Schema.optional(shortText),
  body: Schema.optional(bodyText),
  footer: Schema.optional(bodyText),
  action: Schema.optional(shortText),
}).annotate({ identifier: "AuthEmailContent" });

export const AuthEmailTranslations = Schema.Struct({
  en: Schema.optional(AuthEmailContent),
  fr: Schema.optional(AuthEmailContent),
}).annotate({ identifier: "AuthEmailTranslations" });

export const AuthEmailAppearance = Schema.Struct({
  background: Schema.optional(color),
  foreground: Schema.optional(color),
  card: Schema.optional(color),
  primary: Schema.optional(color),
  primaryForeground: Schema.optional(color),
  muted: Schema.optional(color),
  mutedForeground: Schema.optional(color),
  border: Schema.optional(color),
  logoWidth: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 32, maximum: 400 })),
  ),
  logoAlignment: Schema.optional(Schema.Literals(["left", "center", "right"])),
  logoSpacingTop: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 96 })),
  ),
  logoSpacingBottom: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 96 })),
  ),
  alignment: Schema.optional(Schema.Literals(["left", "center", "right"])),
  padding: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 16, maximum: 64 })),
  ),
  radius: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 32 })),
  ),
}).annotate({ identifier: "AuthEmailAppearance" });

export const AuthEmailSettings = Schema.Struct({
  appearance: Schema.optional(AuthEmailAppearance),
  templates: Schema.optional(
    Schema.Struct({
      "sign-in": Schema.optional(AuthEmailTranslations),
      "email-verification": Schema.optional(AuthEmailTranslations),
      "forget-password": Schema.optional(AuthEmailTranslations),
      "change-email": Schema.optional(AuthEmailTranslations),
      "two-factor": Schema.optional(AuthEmailTranslations),
      "reset-password": Schema.optional(AuthEmailTranslations),
    }),
  ),
}).annotate({ identifier: "AuthEmailSettings" });

export const AuthEmailPreviewPayload = Schema.Struct({
  kind: AuthEmailKind,
  locale: Schema.Literals(["en", "fr"]),
  settings: AuthEmailSettings,
}).annotate({ identifier: "AuthEmailPreviewPayload" });

export const AuthEmailPreview = Schema.Struct({
  subject: Schema.String,
  html: Schema.String,
  text: Schema.String,
}).annotate({ identifier: "AuthEmailPreview" });

export type AuthEmailKind = typeof AuthEmailKind.Type;
export type AuthEmailSettings = typeof AuthEmailSettings.Type;
export type AuthEmailAppearance = typeof AuthEmailAppearance.Type;
export type AuthEmailContent = typeof AuthEmailContent.Type;
export type AuthEmailPreviewPayload = typeof AuthEmailPreviewPayload.Type;
