import { describe, expect, it } from "@effect/vitest";

import { apiKeyReferrers, withApiKeyReferrers } from "./api-key-referrers";

describe("API key referrer metadata", () => {
  it("reads allowed origins from object and JSON metadata", () => {
    expect(
      apiKeyReferrers({ allowedOrigins: ["https://app.example.com"] }),
    ).toEqual(["https://app.example.com"]);
    expect(
      apiKeyReferrers('{"allowedOrigins":["https://admin.example.com"]}'),
    ).toEqual(["https://admin.example.com"]);
  });

  it("preserves unrelated metadata when replacing referrers", () => {
    expect(
      withApiKeyReferrers({ environment: "production" }, [
        "https://app.example.com",
      ]),
    ).toEqual({
      environment: "production",
      allowedOrigins: ["https://app.example.com"],
    });
  });
});
