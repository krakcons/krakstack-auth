import { Option, Schema, SchemaGetter } from "effect";

export const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  role: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  lastLoginMethod: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({
  identifier: "User",
  title: "User",
  description: "Stable central auth user record.",
  examples: [
    {
      id: "user_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      image: null,
      role: "admin",
      banned: false,
      lastLoginMethod: "email-otp",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const Session = Schema.Struct({
  id: Schema.String,
  expiresAt: Schema.Date,
  token: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
  userAgent: Schema.optional(Schema.NullOr(Schema.String)),
  userId: Schema.String,
  impersonatedBy: Schema.optional(Schema.NullOr(Schema.String)),
  impersonatedByOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
  activeOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({
  identifier: "Session",
  title: "Session",
  description: "Current browser session record.",
  examples: [
    {
      id: "session_1",
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      token: "session-token",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
      userId: "user_1",
      impersonatedBy: null,
      impersonatedByOrganizationId: null,
      activeOrganizationId: "org_1",
    },
  ],
});

export const OrganizationLocale = Schema.Union([
  Schema.Literal("en"),
  Schema.Literal("fr"),
]).annotate({
  identifier: "OrganizationLocale",
  title: "Organization locale",
  description: "Supported organization translation locale.",
  examples: ["en", "fr"],
});

export const EmailAddress = Schema.NonEmptyString.check(
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
).annotate({
  identifier: "EmailAddress",
  title: "Email address",
});

export const PhoneNumber = Schema.NonEmptyString.check(
  Schema.isPattern(/^\+?[0-9 ()-]{7,}$/),
).annotate({
  identifier: "PhoneNumber",
  title: "Phone number",
});

export const WebsiteUrl = Schema.NonEmptyString.check(
  Schema.isPattern(/^https?:\/\/[^\s]+$/),
).annotate({
  identifier: "WebsiteUrl",
  title: "Website URL",
});

export const SocialPlatform = Schema.Literals([
  "facebook",
  "github",
  "instagram",
  "linkedin",
  "tiktok",
  "x",
  "youtube",
]).annotate({
  identifier: "SocialPlatform",
  title: "Social platform",
});

export const OrganizationContactTranslation = Schema.Struct({
  locale: OrganizationLocale,
  label: Schema.NonEmptyString.check(Schema.isPattern(/\S/)),
}).annotate({
  identifier: "OrganizationContactTranslation",
  title: "Organization contact translation",
});

export const OrganizationEmail = Schema.Struct({
  email: EmailAddress,
  translations: Schema.Array(OrganizationContactTranslation).check(
    Schema.isMinLength(1),
  ),
}).annotate({
  identifier: "OrganizationEmail",
  title: "Organization email",
});

export const OrganizationPhone = Schema.Struct({
  number: PhoneNumber,
  extension: Schema.optional(Schema.String),
  translations: Schema.Array(OrganizationContactTranslation).check(
    Schema.isMinLength(1),
  ),
}).annotate({
  identifier: "OrganizationPhone",
  title: "Organization phone",
});

export const OrganizationWebsite = Schema.Struct({
  url: WebsiteUrl,
  translations: Schema.Array(OrganizationContactTranslation).check(
    Schema.isMinLength(1),
  ),
}).annotate({
  identifier: "OrganizationWebsite",
  title: "Organization website",
});

export const OrganizationSocial = Schema.Struct({
  platform: SocialPlatform,
  url: WebsiteUrl,
  translations: Schema.Array(OrganizationContactTranslation).check(
    Schema.isMinLength(1),
  ),
}).annotate({
  identifier: "OrganizationSocial",
  title: "Organization social profile",
});

export const PostalAddress = Schema.Struct({
  streetAddress: Schema.optional(Schema.String),
  locality: Schema.optional(Schema.String),
  region: Schema.optional(Schema.String),
  postalCode: Schema.optional(Schema.String),
  country: Schema.optional(Schema.String),
}).annotate({
  identifier: "PostalAddress",
  title: "Postal address",
  description: "Structured postal address compatible with OIDC address claims.",
  examples: [
    {
      streetAddress: "123 Example Street",
      locality: "Montreal",
      region: "QC",
      postalCode: "H2X 1Y4",
      country: "Canada",
    },
  ],
});

export const OrganizationAddress = Schema.Struct({
  ...PostalAddress.fields,
  translations: Schema.Array(OrganizationContactTranslation).check(
    Schema.isMinLength(1),
  ),
}).annotate({
  identifier: "OrganizationAddress",
  title: "Organization address",
});

export const FormattedOrganizationAddress = Schema.Struct({
  ...OrganizationAddress.fields,
  formatted: Schema.String,
}).annotate({
  identifier: "FormattedOrganizationAddress",
  title: "Formatted organization address",
  description: "Organization address with a server-generated display value.",
});

export const OrganizationTranslation = Schema.Struct({
  locale: OrganizationLocale,
  name: Schema.String,
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  // Retained when decoding metadata written before repeatable contacts.
  contactEmail: Schema.optional(Schema.NullOr(Schema.String)),
  // Retained when decoding metadata written before structured addresses.
  location: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({
  identifier: "OrganizationTranslation",
  title: "Organization translation",
  description: "Localized display metadata for an organization.",
  examples: [
    {
      locale: "en",
      name: "KrakStack",
      logo: "https://example.com/logo.svg",
      icon: "https://example.com/icon.png",
    },
  ],
});

export const OrganizationMetadata = Schema.Struct({
  translations: Schema.Array(OrganizationTranslation),
  emails: Schema.optional(Schema.Array(OrganizationEmail)),
  phones: Schema.optional(Schema.Array(OrganizationPhone)),
  websites: Schema.optional(Schema.Array(OrganizationWebsite)),
  socials: Schema.optional(Schema.Array(OrganizationSocial)),
  addresses: Schema.optional(Schema.Array(OrganizationAddress)),
}).annotate({
  identifier: "OrganizationMetadata",
  title: "Organization metadata",
  description:
    "Localized profile and contact details stored on an organization record.",
  examples: [
    {
      translations: [
        {
          locale: "en",
          name: "KrakStack",
          logo: "https://example.com/logo.svg",
          icon: "https://example.com/icon.png",
        },
      ],
      emails: [
        {
          email: "team@example.com",
          translations: [{ locale: "en", label: "General inquiries" }],
        },
      ],
      phones: [
        {
          number: "+1 514 555 0100",
          translations: [{ locale: "en", label: "Office" }],
        },
      ],
      websites: [
        {
          url: "https://example.com",
          translations: [{ locale: "en", label: "Website" }],
        },
      ],
      socials: [
        {
          platform: "linkedin",
          url: "https://linkedin.com/company/example",
          translations: [{ locale: "en", label: "LinkedIn" }],
        },
      ],
      addresses: [
        {
          streetAddress: "123 Example Street",
          locality: "Montreal",
          region: "QC",
          postalCode: "H2X 1Y4",
          country: "Canada",
          translations: [{ locale: "en", label: "Head office" }],
        },
      ],
    },
  ],
});

const OrganizationMetadataRecord = Schema.Record(Schema.String, Schema.Unknown);
const OrganizationMetadataInput = Schema.Union([
  OrganizationMetadataRecord,
  Schema.fromJsonString(OrganizationMetadataRecord),
]);

export const decodeOrganizationMetadata = (
  metadata: typeof Schema.Unknown.Type,
): OrganizationMetadata => {
  const value = Schema.decodeUnknownOption(OrganizationMetadataInput)(metadata);
  if (Option.isNone(value)) return { translations: [] };

  const translations = Schema.decodeUnknownOption(
    Schema.Array(OrganizationTranslation),
  )(value.value.translations);
  const emails = Schema.decodeUnknownOption(Schema.Array(OrganizationEmail))(
    value.value.emails,
  );
  const phones = Schema.decodeUnknownOption(Schema.Array(OrganizationPhone))(
    value.value.phones,
  );
  const websites = Schema.decodeUnknownOption(
    Schema.Array(OrganizationWebsite),
  )(value.value.websites);
  const socials = Schema.decodeUnknownOption(Schema.Array(OrganizationSocial))(
    value.value.socials,
  );
  const addresses = Schema.decodeUnknownOption(
    Schema.Array(OrganizationAddress),
  )(value.value.addresses);

  let result: OrganizationMetadata = {
    translations: Option.getOrElse(translations, () => []),
  };
  if (Option.isSome(emails)) result = { ...result, emails: emails.value };
  if (Option.isSome(phones)) result = { ...result, phones: phones.value };
  if (Option.isSome(websites)) result = { ...result, websites: websites.value };
  if (Option.isSome(socials)) result = { ...result, socials: socials.value };
  if (Option.isSome(addresses))
    result = { ...result, addresses: addresses.value };
  return result;
};

const CompatibleOrganizationMetadata = Schema.Unknown.pipe(
  Schema.decodeTo(OrganizationMetadata, {
    decode: SchemaGetter.transform(decodeOrganizationMetadata),
    encode: SchemaGetter.transform((metadata) => metadata),
  }),
);

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(CompatibleOrganizationMetadata),
  parentId: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
}).annotate({
  identifier: "Organization",
  title: "Organization",
  description: "Stable central auth organization record.",
  examples: [
    {
      id: "org_1",
      name: "KrakStack",
      slug: "krakstack",
      logo: null,
      parentId: null,
      metadata: {
        translations: [
          {
            locale: "en",
            name: "KrakStack",
            logo: null,
            icon: null,
          },
        ],
        emails: [
          {
            email: "team@example.com",
            translations: [{ locale: "en", label: "General inquiries" }],
          },
        ],
        phones: [
          {
            number: "+1 514 555 0100",
            translations: [{ locale: "en", label: "Office" }],
          },
        ],
        websites: [
          {
            url: "https://example.com",
            translations: [{ locale: "en", label: "Website" }],
          },
        ],
        socials: [
          {
            platform: "linkedin",
            url: "https://linkedin.com/company/example",
            translations: [{ locale: "en", label: "LinkedIn" }],
          },
        ],
        addresses: [
          {
            streetAddress: "123 Example Street",
            locality: "Montreal",
            region: "QC",
            postalCode: "H2X 1Y4",
            country: "Canada",
            translations: [{ locale: "en", label: "Head office" }],
          },
        ],
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
});

export const Member = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  userId: Schema.String,
  role: Schema.String,
  createdAt: Schema.Date,
  user: User,
}).annotate({
  identifier: "Member",
  title: "Member",
  description: "Stable central auth organization member record.",
  examples: [
    {
      id: "member_1",
      organizationId: "org_1",
      userId: "user_1",
      role: "admin",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: {
        id: "user_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        image: null,
        role: "admin",
        banned: false,
        lastLoginMethod: "email-otp",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  ],
});

export type User = typeof User.Type;
export type Session = typeof Session.Type;
export type OrganizationLocale = typeof OrganizationLocale.Type;
export type EmailAddress = typeof EmailAddress.Type;
export type PhoneNumber = typeof PhoneNumber.Type;
export type WebsiteUrl = typeof WebsiteUrl.Type;
export type SocialPlatform = typeof SocialPlatform.Type;
export type PostalAddress = typeof PostalAddress.Type;
export type OrganizationAddress = typeof OrganizationAddress.Type;
export type FormattedOrganizationAddress =
  typeof FormattedOrganizationAddress.Type;
export type OrganizationContactTranslation =
  typeof OrganizationContactTranslation.Type;
export type OrganizationEmail = typeof OrganizationEmail.Type;
export type OrganizationPhone = typeof OrganizationPhone.Type;
export type OrganizationWebsite = typeof OrganizationWebsite.Type;
export type OrganizationSocial = typeof OrganizationSocial.Type;
export type OrganizationTranslation = typeof OrganizationTranslation.Type;
export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type Organization = typeof Organization.Type;
export type Member = typeof Member.Type;
