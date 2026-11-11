import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { McpEndpointUrl, ProjectMcpSettings } from "./schema";

describe("MCP endpoint validation", () => {
  for (const url of [
    "https://learning.example.com/api/mcp",
    "http://localhost:3000/api/mcp",
    "http://127.0.0.1:3000/api/mcp",
    "http://[::1]:3000/api/mcp",
  ]) {
    it(`accepts ${url}`, () =>
      expect(Schema.is(McpEndpointUrl)(url)).toBe(true));
  }
  for (const url of [
    "not-a-url",
    "http://remote.example.com/api/mcp",
    "https://user:password@example.com/mcp",
    "https://example.com/mcp?secret=token",
    "https://example.com/mcp#fragment",
  ]) {
    it(`rejects ${url}`, () =>
      expect(Schema.is(McpEndpointUrl)(url)).toBe(false));
  }
  it("accepts delegated write access but rejects unsupported scopes", () => {
    expect(
      Schema.is(ProjectMcpSettings)({
        url: "https://example.com/mcp",
        enabled: true,
        dynamicClientRegistration: true,
        scopes: ["mcp:read", "mcp:write"],
      }),
    ).toBe(true);
    expect(
      Schema.is(ProjectMcpSettings)({
        url: "https://example.com/mcp",
        enabled: true,
        dynamicClientRegistration: true,
        scopes: ["admin"],
      }),
    ).toBe(false);
  });
});
