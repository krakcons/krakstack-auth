import { describe, expect, it } from "@effect/vitest";
import { createAuth } from "./config";
import {
  nativeAuditDiagnostic,
  nativeAuditExclusion,
  nativeAuditOperation,
  serverOnlyAuditExclusions,
} from "./audit-policy";

describe("configured native endpoint audit inventory", () => {
  it("uses canonical action codes and explicitly excludes protocol and setup details", () => {
    for (const [operation, paths] of [
      [
        "session.signed_in",
        [
          "/sign-in/email",
          "/sign-in/email-otp",
          "/sign-in/anonymous",
          "/sign-in/social",
          "/callback/:id",
          "/two-factor/verify-totp",
          "/two-factor/verify-otp",
          "/two-factor/verify-backup-code",
        ],
      ],
      ["password.reset", ["/reset-password", "/email-otp/reset-password"]],
      [
        "user.deleted",
        [
          "/delete-user",
          "/delete-user/callback",
          "/delete-anonymous-user",
          "/admin/remove-user",
        ],
      ],
      [
        "session.revoked",
        [
          "/revoke-session",
          "/revoke-sessions",
          "/revoke-other-sessions",
          "/admin/revoke-user-session",
          "/admin/revoke-user-sessions",
        ],
      ],
      [
        "oauth_client.created",
        [
          "/oauth2/register",
          "/oauth2/create-client",
          "/admin/oauth2/create-client",
        ],
      ],
      [
        "oauth_client.updated",
        ["/oauth2/update-client", "/admin/oauth2/update-client"],
      ],
    ] as const) {
      for (const path of paths)
        expect(nativeAuditOperation(path, "POST")).toBe(operation);
    }
    for (const path of [
      "/token",
      "/refresh-token",
      "/get-access-token",
      "/oauth2/authorize",
      "/oauth2/consent",
      "/oauth2/continue",
      "/oauth2/token",
      "/oauth2/revoke",
      "/two-factor/get-totp-uri",
      "/update-session",
      "/organization/set-active",
    ]) {
      expect(nativeAuditOperation(path, "POST")).toBeUndefined();
      expect(nativeAuditExclusion(path, "POST")).toBeTruthy();
    }
    expect(
      nativeAuditOperation("/future-unknown-action", "POST"),
    ).toBeUndefined();
    expect(
      nativeAuditExclusion("/future-unknown-action", "POST"),
    ).toBeUndefined();
  });
  it("demotes internal app steps and profile reads, not native security actions", () => {
    for (const path of [
      "/request-password-reset",
      "/send-verification-email",
      "/email-otp/send-verification-otp",
      "/two-factor/send-otp",
      "/email-otp/check-verification-otp",
    ]) {
      expect(nativeAuditOperation(path, "POST")).toBeUndefined();
      expect(nativeAuditExclusion(path, "POST")).toBeTruthy();
      expect(nativeAuditDiagnostic(path, true)).toBe("excluded_auth_detail");
    }
    for (const path of [
      "/organization/create",
      "/organization/delete",
      "/admin/oauth2/create-client",
      "/admin/oauth2/update-client",
      "/oauth2/delete-client",
    ]) {
      expect(nativeAuditDiagnostic(path, false)).toBe("app_owned_action_step");
      expect(nativeAuditDiagnostic(path, true)).toBeUndefined();
      expect(nativeAuditOperation(path, "POST")).toBeTruthy();
    }
    expect(nativeAuditOperation("/account-info", "GET")).toBeUndefined();
    expect(nativeAuditExclusion("/account-info", "GET")).toBeTruthy();
    expect(nativeAuditDiagnostic("/account-info", true)).toBe(
      "provider_profile_read",
    );
    for (const path of ["/get-session", "/jwks"]) {
      expect(nativeAuditOperation(path, "GET")).toBeUndefined();
      expect(nativeAuditExclusion(path, "GET")).toBeTruthy();
    }
    for (const path of [
      "/reset-password",
      "/api-key/create",
      "/admin/set-role",
      "/admin/revoke-user-sessions",
    ]) {
      expect(nativeAuditOperation(path, "POST")).toBeTruthy();
      expect(nativeAuditDiagnostic(path, false)).toBeUndefined();
      expect(nativeAuditDiagnostic(path, true)).toBeUndefined();
    }
  });
  it("classifies every configured route/method and explicitly identifies server-only helpers", () => {
    const auth = createAuth({ allowedHosts: ["localhost:3001"] });
    const missing: Array<string> = [];
    for (const [name, endpoint] of Object.entries(auth.api)) {
      if (!endpoint.path) {
        if (!serverOnlyAuditExclusions.has(name))
          missing.push(`server-only ${name}`);
        continue;
      }
      for (const method of [endpoint.options.method].flat()) {
        const operation = nativeAuditOperation(endpoint.path, method);
        if (operation) expect(operation).not.toMatch(/\.(success|completed)$/);
        const exclusion = nativeAuditExclusion(endpoint.path, method);
        if (!operation && !exclusion)
          missing.push(`${method} ${endpoint.path}`);
        expect(operation && exclusion).toBeFalsy();
      }
    }
    expect(missing).toEqual([]);
    expect(nativeAuditOperation("/callback/:id", "GET")).toBe(
      "session.signed_in",
    );
    expect(nativeAuditOperation("/reset-password", "POST")).toBe(
      "password.reset",
    );
    expect(
      nativeAuditOperation("/admin/oauth2/resources/:identifier", "GET"),
    ).toBeUndefined();
    expect(
      nativeAuditOperation("/admin/oauth2/resources/:identifier", "DELETE"),
    ).toBe("oauth_resource.deleted");
  });
});
