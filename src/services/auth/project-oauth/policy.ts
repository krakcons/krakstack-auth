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

export const sharedSsoCallback = () => {
  const central = centralOAuthOrigin();
  return central ? new URL(sharedSsoPath, central).href : null;
};
