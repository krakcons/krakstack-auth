import { Schema } from "effect";

import { OrganizationMetadata } from "../schema";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const cn = (
  ...inputs: ReadonlyArray<string | false | null | undefined>
) => inputs.filter(Boolean).join(" ");

export type OrganizationBrandingLocale = "en" | "fr";

export interface OrganizationBrandingSource {
  readonly name: string;
  readonly logo?: string | null | undefined;
  readonly metadata?: unknown;
}

const parseOrganizationMetadata = (metadata: unknown) => {
  try {
    const value =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    return Schema.decodeUnknownSync(OrganizationMetadata)(value);
  } catch {
    return { translations: [] };
  }
};

export const organizationBranding = (
  organization: OrganizationBrandingSource | null | undefined,
  locale: OrganizationBrandingLocale = "en",
) => {
  if (!organization) return null;

  const translations = parseOrganizationMetadata(
    organization.metadata,
  ).translations;
  const translation =
    translations.find((item) => item.locale === locale) ??
    translations.find((item) => item.locale === "en") ??
    translations[0];

  return {
    name: translation?.name || organization.name,
    logo: translation?.icon || translation?.logo || organization.logo,
  };
};

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
  const key = assetKey(path);

  if (!key) return path;

  const route = assetRoute(key);
  if (!baseUrl?.trim()) return route;

  return new URL(route, baseUrl).toString();
};
