import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { Option, Schema } from "effect";

const RegistrationMetadata = Schema.StructWithRest(
  Schema.Struct({
    redirect_uris: Schema.NonEmptyArray(Schema.String),
    application_type: Schema.optional(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
).annotate({ identifier: "McpRegistrationMetadata" });

/** Older MCP clients omit OIDC application_type for loopback callbacks. Infer
 * native only for validated loopback HTTP URLs; preserve explicit client policy. */
export const mcpRegistration = (): BetterAuthPlugin => ({
  id: "mcp-registration",
  hooks: {
    before: [
      {
        matcher: (context) => context.path === "/oauth2/register",
        handler: createAuthMiddleware(async (context) => {
          const metadata = Schema.decodeUnknownOption(RegistrationMetadata)(
            context.body,
          );
          if (
            Option.isNone(metadata) ||
            metadata.value.application_type !== undefined
          )
            return;
          const urls = Schema.decodeOption(
            Schema.NonEmptyArray(Schema.URLFromString),
          )(metadata.value.redirect_uris);
          if (Option.isNone(urls)) return;
          const loopback = urls.value.every((url) => {
            return (
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            );
          });
          if (loopback)
            return {
              context: {
                body: { ...metadata.value, application_type: "native" },
              },
            };
        }),
      },
    ],
  },
});
