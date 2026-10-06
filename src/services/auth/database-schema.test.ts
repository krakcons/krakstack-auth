import { describe, expect, it } from "@effect/vitest";
import { getAuthTables } from "@better-auth/core/db";

import { createAuth } from "./config";

describe.skipIf(!process.env.TEST_DATABASE_URL)("Better Auth SQL names", () => {
  it("preserves the existing PostgreSQL table and column names", async () => {
    const auth = createAuth({ allowedHosts: ["localhost:3001"] });
    await auth.$context;
    const tables = getAuthTables(auth.options);
    expect(tables.user?.fields.emailVerified?.fieldName).toBe("email_verified");
    expect(tables.session?.fields.activeOrganizationId?.fieldName).toBe(
      "active_organization_id",
    );
    expect(tables.session?.fields.impersonatedByOrganizationId?.fieldName).toBe(
      "impersonated_by_organization_id",
    );
    expect(tables.twoFactor?.modelName).toBe("two_factor");
    expect(tables.oauthClient?.modelName).toBe("oauth_client");
    expect(tables.oauthClient?.fields.requirePKCE?.fieldName).toBe(
      "require_pkce",
    );
    expect(tables.oauthRefreshToken?.modelName).toBe("oauth_refresh_token");
    expect(tables.apikey?.fields.referenceId?.fieldName).toBe("reference_id");
    expect(tables.organization?.fields.parentId?.fieldName).toBe("parent_id");
  });
});
