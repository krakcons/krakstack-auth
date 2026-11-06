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
export const AuthEmailColor = Schema.String.check(
  Schema.isPattern(/^#[0-9a-fA-F]{6}$/),
).annotate({ identifier: "AuthEmailColor" });
const color = AuthEmailColor;

export const AuthEmailFont = Schema.Literals([
  "sans",
  "poppins",
  "serif",
  "mono",
]).annotate({ identifier: "AuthEmailFont" });
export const AuthEmailAlignment = Schema.Literals([
  "left",
  "center",
  "right",
]).annotate({ identifier: "AuthEmailAlignment" });
export const AuthEmailGap = Schema.Literals([
  "small",
  "medium",
  "large",
]).annotate({ identifier: "AuthEmailGap" });
export const emailSizeOptions = {
  heading: [20, 24, 30, 32, 36, 48],
  body: [12, 14, 16, 18, 20, 24],
  code: [20, 24, 30, 36, 48],
  button: [14, 16, 18, 20, 24],
  help: [12, 14, 16, 18, 20],
  projectName: [12, 14, 16, 18, 20],
} as const;
const fontSize = (sizes: ReadonlyArray<number>) => Schema.Literals(sizes);
const textFormatting = {
  bold: Schema.optional(Schema.Boolean),
  italic: Schema.optional(Schema.Boolean),
  underline: Schema.optional(Schema.Boolean),
  strikethrough: Schema.optional(Schema.Boolean),
};
export const AuthEmailTextStyle = Schema.Struct({
  ...textFormatting,
  font: Schema.optional(AuthEmailFont),
  size: Schema.optional(fontSize(emailSizeOptions.body)),
  color: Schema.optional(color),
}).annotate({ identifier: "AuthEmailTextStyle" });
const roleStyle = (identifier: string, sizes: ReadonlyArray<number>) =>
  Schema.Struct({
    ...textFormatting,
    font: Schema.optional(AuthEmailFont),
    size: Schema.optional(fontSize(sizes)),
    alignment: Schema.optional(AuthEmailAlignment),
    color: Schema.optional(color),
  }).annotate({ identifier });
export const AuthEmailTypography = Schema.Struct({
  font: Schema.optional(AuthEmailFont),
  heading: Schema.optional(
    roleStyle("AuthEmailHeadingStyle", emailSizeOptions.heading),
  ),
  body: Schema.optional(roleStyle("AuthEmailBodyStyle", emailSizeOptions.body)),
  code: Schema.optional(roleStyle("AuthEmailCodeStyle", emailSizeOptions.code)),
  button: Schema.optional(
    roleStyle("AuthEmailButtonStyle", emailSizeOptions.button),
  ),
  help: Schema.optional(roleStyle("AuthEmailHelpStyle", emailSizeOptions.help)),
  projectName: Schema.optional(
    roleStyle("AuthEmailProjectNameStyle", emailSizeOptions.projectName),
  ),
}).annotate({ identifier: "AuthEmailTypography" });

// URL parsing and scheme restrictions live at the schema boundary, not in UI checks.
export const AuthEmailLinkDestination = Schema.String.check(
  Schema.isMaxLength(2000),
  Schema.makeFilter((value) => {
    if (/[\s\p{Cc}\\{}]/u.test(value) || /%(?:0a|0d)/i.test(value))
      return false;
    if (value.startsWith("mailto:"))
      return /^mailto:[a-z0-9.!#$%&'*+/=?^_`|~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
        value,
      );
    if (!/^https:\/\//i.test(value)) return false;
    const parsed = URL.parse(value);
    return (
      parsed !== null &&
      parsed.protocol === "https:" &&
      !!parsed.hostname &&
      !parsed.username &&
      !parsed.password
    );
  }),
).annotate({ identifier: "AuthEmailLinkDestination" });
const localizedText = Schema.Struct({ en: bodyText, fr: bodyText }).annotate({
  identifier: "AuthEmailLocalizedBlockText",
});
const localizedLink = Schema.Struct({
  label: singleLine,
  url: Schema.Union([Schema.Literal(""), AuthEmailLinkDestination]),
}).annotate({ identifier: "AuthEmailLocalizedLink" });
const blockFields = {
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
};
export const AuthEmailBlock = Schema.Union([
  Schema.Struct({
    ...blockFields,
    type: Schema.Literal("text"),
    text: localizedText,
    alignment: Schema.optional(AuthEmailAlignment),
    tone: Schema.optional(Schema.Literals(["normal", "muted"])),
    style: Schema.optional(AuthEmailTextStyle),
  }),
  Schema.Struct({
    ...blockFields,
    type: Schema.Literal("link"),
    translations: Schema.Struct({ en: localizedLink, fr: localizedLink }),
    alignment: Schema.optional(AuthEmailAlignment),
    style: Schema.optional(AuthEmailTextStyle),
  }),
  Schema.Struct({ ...blockFields, type: Schema.Literal("divider") }),
  Schema.Struct({
    ...blockFields,
    type: Schema.Literal("spacer"),
    size: AuthEmailGap,
  }),
]).annotate({ identifier: "AuthEmailBlock" });
export const AuthEmailPublishedBlock = AuthEmailBlock.check(
  Schema.makeFilter((block) =>
    block.type === "text"
      ? !!block.text.en.trim() && !!block.text.fr.trim()
      : block.type === "link"
        ? [block.translations.en, block.translations.fr].every(
            (translation) =>
              !!translation.label.trim() &&
              Schema.is(AuthEmailLinkDestination)(translation.url),
          )
        : true,
  ),
).annotate({ identifier: "AuthEmailPublishedBlock" });
export const AuthEmailSection = Schema.Struct({
  blocks: Schema.Array(AuthEmailBlock).check(Schema.isMaxLength(8)),
  gap: Schema.optional(AuthEmailGap),
}).annotate({ identifier: "AuthEmailSection" });

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
  logoPlacement: Schema.optional(
    Schema.Literals(["header", "card", "footer", "hidden"]),
  ),
  showProjectName: Schema.optional(Schema.Boolean),
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

export const AuthEmailDraftSettings = Schema.Struct({
  appearance: Schema.optional(AuthEmailAppearance),
  typography: Schema.optional(AuthEmailTypography),
  layout: Schema.optional(
    Schema.Struct({
      header: Schema.optional(AuthEmailSection),
      footer: Schema.optional(AuthEmailSection),
    }),
  ),
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
})
  .check(
    Schema.makeFilter((settings) => {
      const blocks = [
        ...(settings.layout?.header?.blocks ?? []),
        ...(settings.layout?.footer?.blocks ?? []),
      ];
      return new Set(blocks.map((block) => block.id)).size === blocks.length;
    }),
  )
  .annotate({ identifier: "AuthEmailDraftSettings" });

export const AuthEmailSettings = AuthEmailDraftSettings.check(
  Schema.makeFilter((settings) =>
    [settings.layout?.header, settings.layout?.footer].every(
      (section) =>
        section?.blocks.every(Schema.is(AuthEmailPublishedBlock)) ?? true,
    ),
  ),
).annotate({ identifier: "AuthEmailSettings" });

export const AuthEmailPreviewPayload = Schema.Struct({
  kind: AuthEmailKind,
  locale: Schema.Literals(["en", "fr"]),
  settings: AuthEmailDraftSettings,
}).annotate({ identifier: "AuthEmailPreviewPayload" });

export const AuthEmailTestPayload = Schema.Struct({
  kind: AuthEmailKind,
  locale: Schema.Literals(["en", "fr"]),
  settings: AuthEmailSettings,
}).annotate({ identifier: "AuthEmailTestPayload" });

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
export type AuthEmailPreview = typeof AuthEmailPreview.Type;
export type AuthEmailBlock = typeof AuthEmailBlock.Type;
export type AuthEmailSection = typeof AuthEmailSection.Type;
export type AuthEmailTypography = typeof AuthEmailTypography.Type;
export type AuthEmailTextStyle = typeof AuthEmailTextStyle.Type;
