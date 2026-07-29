import { describe, expect, it } from "@effect/vitest";

import {
  apiKeyAllowedOrigins,
  encodeApiKeyAllowedOrigins,
  parseApiKeyReferrers,
  requestMatchesAllowedOrigins,
} from "./api-key-referrers";

describe("API key referrers", () => {
  it("allows unrestricted keys without source headers", () => {
    expect(requestMatchesAllowedOrigins(undefined, undefined, [])).toBe(true);
  });

  it("matches the request origin exactly", () => {
    expect(
      requestMatchesAllowedOrigins("https://app.example.com", undefined, [
        "https://app.example.com",
      ]),
    ).toBe(true);
    expect(
      requestMatchesAllowedOrigins("https://other.example.com", undefined, [
        "https://app.example.com",
      ]),
    ).toBe(false);
  });

  it("uses the origin of the Referer URL as a fallback", () => {
    expect(
      requestMatchesAllowedOrigins(
        undefined,
        "https://app.example.com/dashboard?tab=keys",
        ["https://app.example.com"],
      ),
    ).toBe(true);
  });

  it("rejects restricted keys without source headers", () => {
    expect(
      requestMatchesAllowedOrigins(undefined, undefined, [
        "https://app.example.com",
      ]),
    ).toBe(false);
  });

  it("preserves other metadata when encoding allowed origins", () => {
    const encoded = encodeApiKeyAllowedOrigins('{"environment":"production"}', [
      "https://app.example.com",
    ]);

    expect(apiKeyAllowedOrigins(encoded)).toEqual(["https://app.example.com"]);
    expect(encoded).toContain('"environment":"production"');
  });

  it("parses only HTTP(S) referrers", () => {
    expect(
      parseApiKeyReferrers("https://app.example.com/path", "Invalid"),
    ).toEqual(["https://app.example.com"]);
    expect(() =>
      parseApiKeyReferrers("ftp://app.example.com", "Invalid"),
    ).toThrow("Invalid");
  });
});
