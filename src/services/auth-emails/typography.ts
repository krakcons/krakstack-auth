import type { CSSProperties } from "react";
import type {
  AuthEmailSettings,
  AuthEmailTextStyle,
  AuthEmailTypography,
} from "./schema";

export const emailDefaultColors = {
  primary: "#0A1F44",
  primaryForeground: "#FFFFFF",
  background: "#FFFFFF",
  foreground: "#0A1F44",
  card: "#FFFFFF",
  muted: "#F1F5F9",
  mutedForeground: "#767D92",
  border: "#E9F2FA",
  secondary: "#F1F5F9",
  secondaryForeground: "#1C2A47",
};

export const emailFontStacks = {
  sans: "Arial, Helvetica, sans-serif",
  poppins: "Poppins, Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

export type EmailTextRole = Exclude<keyof AuthEmailTypography, "font">;

export const resolveEmailRoleColor = (
  settings: AuthEmailSettings,
  role: EmailTextRole,
) => {
  const key =
    role === "button"
      ? "primaryForeground"
      : role === "projectName"
        ? "mutedForeground"
        : "foreground";
  return (
    settings.typography?.[role]?.color ??
    settings.appearance?.[key] ??
    emailDefaultColors[key]
  );
};

// These are the existing renderer's sizes, including React Email's help-text
// and button defaults. Display resolved values without materializing overrides.
export const emailDefaultTextSizes = {
  heading: 32,
  body: 16,
  code: 30,
  button: 16,
  help: 14,
  projectName: 12,
} satisfies Record<EmailTextRole, number>;

export const resolveEmailTextFormatting = (
  style: AuthEmailTextStyle | undefined,
  defaults: { bold?: boolean; underline?: boolean } = {},
) => ({
  bold: style?.bold ?? defaults.bold ?? false,
  italic: style?.italic ?? false,
  underline: style?.underline ?? defaults.underline ?? false,
  strikethrough: style?.strikethrough ?? false,
});

export const emailRoleIsBold = (role: EmailTextRole) =>
  role === "heading" || role === "code" || role === "projectName";

export const resolveEmailTextStyle = (
  typography: AuthEmailTypography | undefined,
  role: EmailTextRole,
  override?: AuthEmailTextStyle,
) => ({
  font:
    override?.font ?? typography?.[role]?.font ?? typography?.font ?? "sans",
  size:
    override?.size ?? typography?.[role]?.size ?? emailDefaultTextSizes[role],
});

// Omitted styles intentionally leave the existing email's typography untouched.
export const emailTextStyle = (
  typography: AuthEmailTypography | undefined,
  role: EmailTextRole,
  override?: AuthEmailTextStyle,
): CSSProperties => {
  const font = override?.font ?? typography?.[role]?.font ?? typography?.font;
  const size = override?.size ?? typography?.[role]?.size;
  const alignment = typography?.[role]?.alignment;
  const color = override?.color ?? typography?.[role]?.color;
  const formatting = { ...typography?.[role], ...override };
  const style: CSSProperties = {};
  if (formatting.bold !== undefined)
    style.fontWeight = formatting.bold ? 700 : 400;
  if (formatting.italic !== undefined)
    style.fontStyle = formatting.italic ? "italic" : "normal";
  if (
    formatting.underline !== undefined ||
    formatting.strikethrough !== undefined
  ) {
    style.textDecoration =
      [
        formatting.underline ? "underline" : "",
        formatting.strikethrough ? "line-through" : "",
      ]
        .filter(Boolean)
        .join(" ") || "none";
  }
  if (color) style.color = color;
  if (alignment) style.textAlign = alignment;
  if (font) style.fontFamily = emailFontStacks[font];
  if (size) {
    style.fontSize = size;
    style.lineHeight = role === "heading" || role === "code" ? "1.25" : "1.5";
  }
  return style;
};

export const emailGapPixels = { small: 8, medium: 16, large: 24 };
