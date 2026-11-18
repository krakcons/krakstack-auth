import { Schema } from "effect";

export const ProviderOptions = Schema.Struct({
  loginHint: Schema.optionalKey(Schema.String),
  requestSignUp: Schema.optionalKey(Schema.Boolean),
  providerId: Schema.optionalKey(Schema.NonEmptyString),
}).annotate({ identifier: "ProjectOAuthProviderOptions" });

export const GoogleStart = Schema.Struct({
  ...ProviderOptions.fields,
  provider: Schema.Literal("google"),
  callbackURL: Schema.optionalKey(Schema.String),
  newUserCallbackURL: Schema.optionalKey(Schema.String),
  errorCallbackURL: Schema.optionalKey(Schema.String),
  idToken: Schema.optionalKey(Schema.Unknown),
  additionalData: Schema.optionalKey(Schema.Unknown),
  oauth_query: Schema.optionalKey(Schema.String),
  scopes: Schema.optionalKey(Schema.Array(Schema.String)),
}).annotate({ identifier: "ProjectGoogleStart" });

export const ProviderRedirect = Schema.Struct({
  url: Schema.URLFromString,
}).annotate({ identifier: "ProjectOAuthProviderRedirect" });

export const Flow = Schema.Struct({
  id: Schema.String,
  domainId: Schema.String,
  projectId: Schema.String,
  projectOrigin: Schema.String,
  destination: Schema.String,
  errorDestination: Schema.String,
  providerOptions: ProviderOptions,
}).annotate({ identifier: "ProjectOAuthFlow" });

export const Redemption = Schema.Struct({
  destination: Schema.String,
  sessionCookie: Schema.String,
  loginMethod: Schema.Literals(["google", "sso"]),
}).annotate({ identifier: "ProjectOAuthRedemption" });
