import { Option, Schema } from "effect";
import { OrganizationSsoSettings } from "@krak-stack/auth/auth";

// Platform trust policy, not a connection-specific deployment setting. Never
// promote arbitrary URLs supplied by an organization into trusted origins.
export const ssoIdpOrigins = [
  "https://login.microsoftonline.com",
  "https://graph.microsoft.com",
  "https://*.okta.com",
  "https://*.okta-emea.com",
  "https://*.oktapreview.com",
  "https://*.auth0.com",
  "https://accounts.google.com",
  "https://oauth2.googleapis.com",
  "https://openidconnect.googleapis.com",
];

export const ApprovedSsoUrl = Schema.String.check(
  Schema.makeFilter((value) => {
    const parsed = Schema.decodeOption(Schema.URLFromString)(value);
    if (Option.isNone(parsed)) return "Invalid identity provider URL";
    const url = parsed.value;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return "Invalid identity provider URL";
    const exact = [
      "login.microsoftonline.com",
      "graph.microsoft.com",
      "accounts.google.com",
      "oauth2.googleapis.com",
      "openidconnect.googleapis.com",
    ];
    const suffixes = [
      ".okta.com",
      ".okta-emea.com",
      ".oktapreview.com",
      ".auth0.com",
    ];
    return exact.includes(url.hostname) ||
      suffixes.some((suffix) => url.hostname.endsWith(suffix))
      ? undefined
      : "Identity provider origin is not approved";
  }),
).annotate({ identifier: "ApprovedSsoUrl" });

export const SsoIssuer = ApprovedSsoUrl.check(
  Schema.makeFilter((value) => {
    const parsed = Schema.decodeOption(Schema.URLFromString)(value);
    if (Option.isNone(parsed)) return "Invalid issuer";
    const url = parsed.value;
    if (url.search) return "Issuer must not contain a query";
    if (
      url.hostname === "login.microsoftonline.com" &&
      !/^\/[0-9a-f-]{36}\/v2\.0\/?$/i.test(url.pathname)
    )
      return "Use a tenant-specific Microsoft issuer";
    return undefined;
  }),
).annotate({ identifier: "SsoIssuer" });

export const SsoDomain = Schema.String.check(
  Schema.isPattern(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/,
  ),
).annotate({ identifier: "SsoDomain" });

export const SsoSettingsWrite = Schema.Struct({
  ...OrganizationSsoSettings.fields,
  issuer: SsoIssuer,
  domain: SsoDomain,
}).annotate({ identifier: "SsoSettingsWrite" });

export const SsoOidcConfiguration = Schema.Struct({
  issuer: SsoIssuer,
  clientId: Schema.NonEmptyString,
  clientSecret: Schema.NonEmptyString,
  discoveryEndpoint: ApprovedSsoUrl,
  authorizationEndpoint: ApprovedSsoUrl,
  tokenEndpoint: ApprovedSsoUrl,
  jwksEndpoint: ApprovedSsoUrl,
  userInfoEndpoint: Schema.optional(ApprovedSsoUrl),
  pkce: Schema.Literal(true),
  scopes: Schema.Array(Schema.String),
  tokenEndpointAuthentication: Schema.optional(
    Schema.Literals(["client_secret_basic", "client_secret_post"]),
  ),
}).annotate({ identifier: "SsoOidcConfiguration" });
export const SsoOidcJson = Schema.fromJsonString(SsoOidcConfiguration).annotate(
  { identifier: "SsoOidcJson" },
);

export const SsoBinding = Schema.Struct({
  providerId: Schema.NonEmptyString,
  issuer: SsoIssuer,
  domain: SsoDomain,
  organizationId: Schema.NonEmptyString,
  enabled: Schema.Boolean,
  domainVerified: Schema.Boolean,
}).annotate({ identifier: "SsoBinding" });
export type SsoBinding = typeof SsoBinding.Type;

export const SsoStoredConnection = Schema.Struct({
  ...SsoBinding.fields,
  id: Schema.NonEmptyString,
  oidcConfig: Schema.NonEmptyString,
  verificationToken: Schema.NonEmptyString,
}).annotate({ identifier: "SsoStoredConnection" });

export const SsoLocalUser = Schema.Struct({
  id: Schema.NonEmptyString,
  emailVerified: Schema.Boolean,
  isAnonymous: Schema.optional(Schema.NullOr(Schema.Boolean)),
}).annotate({ identifier: "SsoLocalUser" });
export const SsoAccount = Schema.Struct({
  userId: Schema.NonEmptyString,
}).annotate({ identifier: "SsoAccount" });
export const SsoMember = Schema.Struct({ id: Schema.NonEmptyString }).annotate({
  identifier: "SsoMember",
});
export const SsoSessionContext = Schema.Struct({
  krakstackSsoSession: Schema.Struct({
    userId: Schema.NonEmptyString,
    organizationId: Schema.NonEmptyString,
  }),
}).annotate({ identifier: "SsoSessionContext" });
