import { Schema } from "effect";
import { OrganizationMetadata } from "@krak-stack/auth/schema";

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
