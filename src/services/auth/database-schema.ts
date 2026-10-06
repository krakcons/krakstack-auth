import type { BetterAuthPlugin } from "better-auth";
import { Schema, String } from "effect";

const StringArray = Schema.UndefinedOr(
  Schema.NullOr(Schema.Array(Schema.String)),
).annotate({ identifier: "PostgresStringArray" });
const NumberArray = Schema.UndefinedOr(
  Schema.NullOr(Schema.Array(Schema.Number)),
).annotate({ identifier: "PostgresNumberArray" });

// Better Auth's native PostgreSQL adapter must keep the existing physical names.
// Preserve each plugin's field definitions and inference; change only DB names.
export const withSqlNames = <T extends BetterAuthPlugin>(plugin: T): T => {
  for (const [model, table] of Object.entries(plugin.schema ?? {})) {
    table.modelName = String.camelToSnake(table.modelName ?? model);
    for (const [name, field] of Object.entries(table.fields)) {
      field.fieldName =
        name === "requirePKCE"
          ? "require_pkce"
          : String.camelToSnake(field.fieldName ?? name);
      if (field.type === "string[]" || field.type === "number[]") {
        const input = field.transform?.input;
        const arrayType = field.type;
        field.transform = {
          ...field.transform,
          input: async (value) => {
            const transformed = input ? await input(value) : value;
            const array =
              arrayType === "string[]"
                ? Schema.decodeUnknownSync(StringArray)(transformed)
                : Schema.decodeUnknownSync(NumberArray)(transformed);
            if (array === null || array === undefined) return array;
            // Bypass the native adapter's JSON encoding for array fields. pg's
            // parameter encoder handles escaping and the PostgreSQL array format.
            return { toPostgres: () => [...array] };
          },
        };
      }
    }
  }
  return plugin;
};

export const coreSqlFields = {
  user: {
    emailVerified: "email_verified",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  session: {
    expiresAt: "expires_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
    ipAddress: "ip_address",
    userAgent: "user_agent",
    userId: "user_id",
  },
  account: {
    accountId: "account_id",
    providerId: "provider_id",
    userId: "user_id",
    accessToken: "access_token",
    refreshToken: "refresh_token",
    idToken: "id_token",
    accessTokenExpiresAt: "access_token_expires_at",
    refreshTokenExpiresAt: "refresh_token_expires_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  verification: {
    expiresAt: "expires_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};
