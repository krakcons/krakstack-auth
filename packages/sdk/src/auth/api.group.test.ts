import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { OpenApi } from "effect/unstable/httpapi";

import { AuthClientApi } from "../api.js";
import {
  AuthOrganization,
  AuthConflict,
  AuthExpectationFailed,
  FullAuthOrganization,
  AuthSessionResponse,
  AuthUnauthorized,
  SignInEmailResponse,
  SignInResponse,
} from "./schema.js";

const sessionResponse = {
  session: {
    id: "session_1",
    expiresAt: "2026-09-01T00:00:00.000Z",
    token: "token",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    userId: "user_1",
    activeOrganizationId: "organization_1",
  },
  user: {
    id: "user_1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    role: "admin",
    banned: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
};

describe("AuthApiGroup", () => {
  it("publishes the browser auth operations under /api/auth", () => {
    const spec = OpenApi.fromApi(AuthClientApi);

    expect(spec.paths["/api/auth/get-session"]?.get).toBeDefined();
    expect(spec.paths["/api/auth/sign-in/email"]?.post).toBeDefined();
    expect(spec.paths["/api/auth/organization/set-active"]?.post).toBeDefined();
    expect(spec.paths["/api/auth/two-factor/verify-totp"]?.post).toBeDefined();
    expect(spec.paths["/api/auth/oauth2/consent"]?.post).toBeDefined();
  });

  it("decodes auth dates from their JSON representation", () => {
    const decoded =
      Schema.decodeUnknownSync(AuthSessionResponse)(sessionResponse);

    expect(decoded.session.expiresAt).toBeInstanceOf(Date);
    expect(decoded.user.createdAt).toBeInstanceOf(Date);
  });

  it("decodes organization metadata returned as stored JSON text", () => {
    const decoded = Schema.decodeUnknownSync(AuthOrganization)({
      id: "organization_1",
      name: "KrakStack",
      slug: "krakstack",
      metadata: JSON.stringify({ translations: [] }),
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    expect(decoded.metadata).toBe('{"translations":[]}');
  });

  it("decodes full organizations with projected member users", () => {
    const decoded = Schema.decodeUnknownSync(FullAuthOrganization)({
      id: "organization_1",
      name: "Krak",
      slug: "krak",
      logo: null,
      metadata: JSON.stringify({ translations: [] }),
      createdAt: "2026-08-01T00:00:00.000Z",
      invitations: [],
      members: [
        {
          id: "member_1",
          organizationId: "organization_1",
          userId: "user_1",
          role: "owner",
          createdAt: "2026-08-01T00:00:00.000Z",
          user: {
            id: "user_1",
            name: "Billy",
            email: "billy@example.com",
            image: null,
          },
        },
      ],
    });

    expect(decoded.name).toBe("Krak");
    expect(decoded.members[0]?.user.name).toBe("Billy");
  });

  it("decodes redirecting email sign-in responses", () => {
    const decoded = Schema.decodeUnknownSync(SignInEmailResponse)({
      redirect: true,
      token: "token",
      url: "/dashboard",
      user: sessionResponse.user,
    });

    expect("redirect" in decoded ? decoded.redirect : undefined).toBe(true);
    expect(decoded.url).toBe("/dashboard");
  });

  it("decodes tokenless sign-in responses", () => {
    const decoded = Schema.decodeUnknownSync(SignInResponse)({
      user: sessionResponse.user,
    });

    expect(decoded.token).toBeUndefined();
  });

  it("decodes untagged authentication error bodies", () => {
    const decoded = Schema.decodeUnknownSync(AuthUnauthorized)({
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });

    expect(decoded).toBeInstanceOf(AuthUnauthorized);
    expect(decoded.code).toBe("UNAUTHORIZED");
    expect(decoded.message).toBe("Unauthorized");
  });

  it("decodes untagged conflict and expectation failed errors", () => {
    const conflict = Schema.decodeUnknownSync(AuthConflict)({
      message: "Failed to verify backup code. Please try again.",
    });
    const expectationFailed = Schema.decodeUnknownSync(AuthExpectationFailed)({
      code: "LINKING_FAILED",
      message: "Account not linked - unable to create account",
    });

    expect(conflict).toBeInstanceOf(AuthConflict);
    expect(conflict.message).toBe(
      "Failed to verify backup code. Please try again.",
    );
    expect(expectationFailed).toBeInstanceOf(AuthExpectationFailed);
    expect(expectationFailed.code).toBe("LINKING_FAILED");
  });
});
