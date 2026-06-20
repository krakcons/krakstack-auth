export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const assetPath = (value: string | null | undefined) => {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.pathname.startsWith("/api/assets/") ? url.pathname : value;
  } catch {
    return value;
  }
};

export const assetUrl = (
  value: string | null | undefined,
  baseUrl?: string,
) => {
  const path = value?.trim();
  if (!path) return "";
  if (!path.startsWith("/api/assets/")) return path;
  if (!baseUrl?.trim()) return path;

  return new URL(path, baseUrl).toString();
};
