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
