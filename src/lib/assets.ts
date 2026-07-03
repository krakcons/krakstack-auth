const assetRoutePrefix = "/api/auth/assets/";
const legacyAssetRoutePrefix = "/api/assets/";

const assetKey = (value: string) => {
  const path = value.trim();

  if (path.startsWith(assetRoutePrefix))
    return path.slice(assetRoutePrefix.length);
  if (path.startsWith(legacyAssetRoutePrefix)) {
    return path.slice(legacyAssetRoutePrefix.length);
  }
  if (path.startsWith("logos/")) return path;

  return null;
};

const assetRoute = (key: string) =>
  `${assetRoutePrefix}${key.split("/").map(encodeURIComponent).join("/")}`;

export const assetPath = (value: string | null | undefined) => {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return assetKey(url.pathname) ?? value;
  } catch {
    return assetKey(value) ?? value;
  }
};

export const assetUrl = (
  value: string | null | undefined,
  baseUrl?: string,
) => {
  const path = value?.trim();
  if (!path) return "";
  const key = assetPath(path);

  if (!key?.startsWith("logos/")) return path;

  const route = assetRoute(key);
  if (!baseUrl?.trim()) return route;

  return new URL(route, baseUrl).toString();
};
