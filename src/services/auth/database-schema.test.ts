import { describe, expect, it } from "@effect/vitest";
import { getAuthTables } from "@better-auth/core/db";
import { diffSchema, getExpectedSchema } from "@better-auth/core/db/internal";
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import { createAuth } from "./config";
import { sqlTestLayer } from "@/services/database";

describe.skipIf(!process.env.TEST_DATABASE_URL)("Better Auth SQL names", () => {
  it.effect("accepts the migrated schema before querying session users", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const auth = createAuth({ allowedHosts: ["localhost:3001"] });
      expect(
        getAuthTables(auth.options).ssoProvider?.fields.verificationToken,
      ).toMatchObject({
        fieldName: "verification_token",
        required: true,
        input: false,
        returned: false,
      });
      const columns = yield* SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct({
          name: Schema.String,
          nullable: Schema.Boolean,
          hasDefault: Schema.Boolean,
        }).annotate({ identifier: "AuthSchemaTestColumn" }),
        execute: () =>
          sql`SELECT column_name AS name, is_nullable = 'YES' AS nullable,
            column_default IS NOT NULL AS has_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'sso_provider'`,
      })();
      const expected = getExpectedSchema(auth.options).sso_provider;
      expect(expected).toBeDefined();
      if (!expected) throw new Error("Missing SSO provider model");
      expect(
        diffSchema(
          { sso_provider: expected },
          [{ name: "sso_provider", columns: [...columns] }],
        ),
      ).toEqual([]);
      const context = yield* Effect.promise(() => auth.$context);
      const user = yield* Effect.promise(() =>
        context.adapter.findOne({
          model: "user",
          where: [{ field: "id", value: `schema-check-${crypto.randomUUID()}` }],
        }),
      );
      expect(user).toBeNull();
    }).pipe(Effect.provide(sqlTestLayer)),
  );
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
    expect(tables.ssoProvider?.modelName).toBe("sso_provider");
    expect(tables.ssoProvider?.fields.providerId?.fieldName).toBe(
      "provider_id",
    );
    expect(tables.ssoProvider?.fields.domainVerified?.fieldName).toBe(
      "domain_verified",
    );
  });
});
