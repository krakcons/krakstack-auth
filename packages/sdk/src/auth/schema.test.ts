import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { AuthRedirectURLFromString } from "./schema.js";

describe("authentication redirect URL transformation", () => {
  const schema = AuthRedirectURLFromString("https://auth.example.com");
  const decode = Schema.decodeUnknownSync(schema);

  it("resolves relative redirects and round-trips absolute URLs", () => {
    const url = decode("/account?tab=security");

    expect(url.href).toBe("https://auth.example.com/account?tab=security");
    expect(Schema.encodeSync(schema)(url)).toBe(url.href);
    expect(decode("https://app.example.com/account").href).toBe(
      "https://app.example.com/account",
    );
  });

  it("rejects malformed URLs, unsafe protocols, and credentials", () => {
    for (const url of [
      "http://[",
      "javascript:alert(1)",
      "ftp://example.com",
      "https://user:password@example.com",
    ]) {
      expect(() => decode(url)).toThrow();
    }
  });
});
