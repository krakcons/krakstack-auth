const ALLOWED_THEME_VARIABLES = new Set([
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--font-sans",
  "--font-serif",
  "--font-mono",
  "--radius",
  "--shadow-x",
  "--shadow-y",
  "--shadow-blur",
  "--shadow-spread",
  "--shadow-opacity",
  "--shadow-color",
  "--shadow-2xs",
  "--shadow-xs",
  "--shadow-sm",
  "--shadow",
  "--shadow-md",
  "--shadow-lg",
  "--shadow-xl",
  "--shadow-2xl",
  "--tracking-normal",
  "--spacing",
]);

const BLOCK_PATTERN = /(:root|\.dark)\s*\{([^}]*)\}/g;
const UNSAFE_VALUE_PATTERN = /[{};@]|url\s*\(|expression\s*\(/i;

const escapeAttribute = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const readDeclarations = (body: string) =>
  body
    .split(";")
    .map((line) => line.trim())
    .flatMap((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return [];

      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!ALLOWED_THEME_VARIABLES.has(name)) return [];
      if (!value || UNSAFE_VALUE_PATTERN.test(value)) return [];

      return [`  ${name}: ${value};`];
    });

export const sanitizeThemeCss = (css: string | undefined, clientId: string) => {
  if (!css?.trim()) return null;

  const light: string[] = [];
  const dark: string[] = [];

  for (const match of css.matchAll(BLOCK_PATTERN)) {
    const selector = match[1];
    const body = match[2];
    if (!selector || !body) continue;

    const declarations = readDeclarations(body);
    if (selector === ":root") light.push(...declarations);
    if (selector === ".dark") dark.push(...declarations);
  }

  const escapedClientId = escapeAttribute(clientId);
  const blocks = [
    light.length
      ? `[data-oauth-client-theme="${escapedClientId}"] {\n${light.join("\n")}\n}`
      : null,
    dark.length
      ? `.dark [data-oauth-client-theme="${escapedClientId}"] {\n${dark.join("\n")}\n}`
      : null,
  ].filter((block): block is string => Boolean(block));

  return blocks.length ? blocks.join("\n") : null;
};
