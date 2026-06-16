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
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
    null,
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
