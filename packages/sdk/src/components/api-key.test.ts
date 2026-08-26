import { describe, expect, it } from "@effect/vitest";

import { parseApiKeyReferrers } from "./api-key.js";

describe("parseApiKeyReferrers", () => {
  it("normalizes and deduplicates comma- and newline-separated URLs", () => {
    expect(
      parseApiKeyReferrers(
        "https://app.example.com/path, https://admin.example.com\nhttps://app.example.com",
        "Invalid {referrer}",
      ),
    ).toEqual(["https://app.example.com", "https://admin.example.com"]);
  });

  it("explains which referrer is invalid", () => {
    expect(() =>
      parseApiKeyReferrers("not-a-url", "Invalid {referrer}"),
    ).toThrow("Invalid not-a-url");
    expect(() =>
      parseApiKeyReferrers("ftp://app.example.com", "Invalid {referrer}"),
    ).toThrow("Invalid ftp://app.example.com");
  });
});
