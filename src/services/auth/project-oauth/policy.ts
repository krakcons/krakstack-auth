export const sharedSsoPath = "/api/auth/sso/callback";

export const supportsProjectOAuthOrigin = (url: URL) =>
  url.protocol === "https:" ||
  (process.env.NODE_ENV === "development" &&
    url.protocol === "http:" &&
    url.hostname === "localhost");

export const centralOAuthOrigin = () => {
  const value = process.env.BETTER_AUTH_URL ?? "";
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  return supportsProjectOAuthOrigin(url) && url.href === `${url.origin}/`
    ? url
    : null;
};

export const projectOAuthOrigins = (provider: "google" | "sso") =>
  ((
    provider === "sso"
      ? process.env.PROJECT_SSO_OAUTH_ORIGINS
      : process.env.PROJECT_GOOGLE_OAUTH_ORIGINS
  ) ?? "").split(",").map((part) => part.trim()).filter(Boolean);

export const sharedSsoCallbackFor = (origin: string) => {
  const central = centralOAuthOrigin();
  return central && origin !== central.origin && projectOAuthOrigins("sso").includes(origin)
    ? new URL(sharedSsoPath, central).href
    : null;
};
