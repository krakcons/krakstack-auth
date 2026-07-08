import { Schema } from "effect";

import { Session, User } from "../schema";

export const GetSessionPayload = Schema.Struct({}).annotate({
  identifier: "GetSessionPayload",
  title: "Get session payload",
  description: "Empty JSON object payload for Better Auth get-session.",
  examples: [{}],
});

export const GetSessionResponse = Schema.NullOr(
  Schema.Struct({
    session: Session,
    user: User,
  }),
).annotate({
  identifier: "GetSessionResponse",
  title: "Get session response",
  description: "Current Better Auth session and user, or null when signed out.",
  examples: [
    {
      session: {
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
    null,
  ],
});

export const OrganizationImpersonateUserPayload = Schema.Struct({
  organizationId: Schema.NonEmptyString,
  actorUserId: Schema.NonEmptyString,
  targetUserId: Schema.NonEmptyString,
  expiresInSeconds: Schema.optional(Schema.Number),
}).annotate({
  identifier: "OrganizationImpersonateUserPayload",
  title: "Organization impersonate user payload",
  description:
    "Server-to-server payload for creating an organization-scoped impersonation session. The request must include a service API key and the actor's current Better Auth session cookie.",
  examples: [
    {
      organizationId: "org_1",
      actorUserId: "user_admin",
      targetUserId: "user_learner",
      expiresInSeconds: 3600,
    },
  ],
});

export const OrganizationImpersonateUserResponse = Schema.Struct({
  session: Session,
  user: User,
}).annotate({
  identifier: "OrganizationImpersonateUserResponse",
  title: "Organization impersonate user response",
  description:
    "Created Better Auth session and target user. The HTTP response also includes the impersonation session Set-Cookie header and restore cookie for /auth/admin/stop-impersonating.",
  examples: [
    {
      session: {
        id: "session_1",
        expiresAt: new Date("2026-01-01T01:00:00.000Z"),
        token: "session-token",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        ipAddress: "127.0.0.1",
        userAgent: "Kokobi/1.0",
        userId: "user_learner",
        impersonatedBy: "user_admin",
        impersonatedByOrganizationId: "org_1",
        activeOrganizationId: "org_1",
      },
      user: {
        id: "user_learner",
        name: "Grace Hopper",
        email: "grace@example.com",
        emailVerified: true,
        image: null,
        role: null,
        banned: false,
        lastLoginMethod: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  ],
});

export class TooManyRequests extends Schema.ErrorClass<TooManyRequests>(
  "TooManyRequests",
)(
  {
    _tag: Schema.tag("TooManyRequests"),
  },
  {
    identifier: "TooManyRequests",
    title: "Too many requests",
    description: "Rate limit exceeded. Try again later.",
    httpApiStatus: 429,
  },
) {}

export type GetSessionResponse = typeof GetSessionResponse.Type;
export type GetSessionPayload = typeof GetSessionPayload.Type;
export type OrganizationImpersonateUserPayload =
  typeof OrganizationImpersonateUserPayload.Type;
export type OrganizationImpersonateUserResponse =
  typeof OrganizationImpersonateUserResponse.Type;
