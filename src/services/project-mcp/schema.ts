import { Option, Schema } from "effect";

export const McpEndpointUrl = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      const parsed = Schema.decodeOption(Schema.URLFromString)(value);
      if (Option.isNone(parsed)) return false;
      const url = parsed.value;
      return (
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      );
    },
    {
      expected:
        "an HTTPS endpoint URL without credentials, query, or fragment (HTTP is allowed on loopback)",
    },
  ),
).annotate({ identifier: "McpEndpointUrl" });

export const ProjectMcpSettings = Schema.Struct({
  url: McpEndpointUrl,
  enabled: Schema.Boolean,
  dynamicClientRegistration: Schema.Boolean,
  scopes: Schema.NonEmptyArray(Schema.Literals(["mcp:read", "mcp:write"])),
}).annotate({ identifier: "ProjectMcpSettings" });

export const ProjectMcp = Schema.Struct({
  projectId: Schema.NonEmptyString,
  ...ProjectMcpSettings.fields,
}).annotate({ identifier: "ProjectMcp" });

export const ProjectMcpParams = Schema.Struct({
  projectId: Schema.NonEmptyString,
}).annotate({ identifier: "ProjectMcpParams" });

export class InvalidMcpEndpoint extends Schema.TaggedError<
  InvalidMcpEndpoint,
  { readonly brand: unique symbol }
>()("InvalidMcpEndpoint", {}) {}

export type ProjectMcp = typeof ProjectMcp.Type;
export type ProjectMcpSettings = typeof ProjectMcpSettings.Type;
