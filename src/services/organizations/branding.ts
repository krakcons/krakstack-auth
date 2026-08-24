import { Option, Schema } from "effect";
import { OrganizationMetadata } from "@krak-stack/auth/schema";

import { localize, type Locale } from "@/lib/localization";

export interface OrganizationBrandingSource {
  readonly name: string;
  readonly logo?: string | null | undefined;
  readonly metadata?: unknown;
}

const OrganizationMetadataInput = Schema.Union([
  OrganizationMetadata,
  Schema.fromJsonString(OrganizationMetadata),
]);

const parseOrganizationMetadata = (metadata: typeof Schema.Unknown.Type) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(OrganizationMetadataInput)(metadata),
    () => ({ translations: [] }),
  );

export const organizationBranding = (
  organization: OrganizationBrandingSource | null | undefined,
  locale: Locale = "en",
) => {
  if (!organization) return null;

  const translations = parseOrganizationMetadata(
    organization.metadata,
  ).translations;
  const translation = translations.length
    ? localize(
        { locale, fallbackLocale: "en" },
        { translations: Array.from(translations) },
      )
    : null;

  return {
    name: translation?.name || organization.name,
    logo: translation?.icon || translation?.logo || organization.logo,
  };
};
