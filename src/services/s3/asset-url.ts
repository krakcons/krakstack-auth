const siteUrl = process.env.VITE_SITE_URL ?? "http://localhost:3000";

export const s3AssetUrl = (key: string) => {
  const path = `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
  return new URL(path, siteUrl).toString();
};
