import { Schema } from "effect";

export const activeUserEvent = "auth.user_active";

export const AuthenticationActivitySession = Schema.Struct({
  user: Schema.Struct({
    id: Schema.NonEmptyString,
    isAnonymous: Schema.optional(Schema.Boolean),
  }),
  session: Schema.Struct({
    userId: Schema.NonEmptyString,
    expiresAt: Schema.Date,
    impersonatedBy: Schema.optional(Schema.NullOr(Schema.String)),
    impersonatedByOrganizationId: Schema.optional(Schema.NullOr(Schema.String)),
  }),
}).annotate({ identifier: "AuthenticationActivitySession" });

export const AuthenticationActivityProject = Schema.Struct({
  projectId: Schema.NullOr(Schema.String),
}).annotate({ identifier: "AuthenticationActivityProject" });

export const OAuthAuthorizationActivity = Schema.fromJsonString(
  Schema.Struct({
    type: Schema.Literal("authorization_code"),
    query: Schema.Struct({ client_id: Schema.NonEmptyString }),
    userId: Schema.NonEmptyString,
    sessionId: Schema.NonEmptyString,
  }),
).annotate({ identifier: "OAuthAuthorizationActivity" });

export const OAuthAuthorizationSession = Schema.Struct({
  ...AuthenticationActivitySession.fields,
  session: Schema.Struct({
    ...AuthenticationActivitySession.fields.session.fields,
    id: Schema.NonEmptyString,
  }),
}).annotate({ identifier: "OAuthAuthorizationSession" });
