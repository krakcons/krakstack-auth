import { describe, expect, it } from "@effect/vitest";

import { proxyAuthRequest } from "./proxy";

describe("proxyAuthRequest", () => {
  it("forwards the proxied request host instead of the OAuth referer", async () => {
    const previousFetch = globalThis.fetch;
    const captured: { request?: Request } = {};

    globalThis.fetch = ((request: RequestInfo | URL) => {
      captured.request =
        request instanceof Request ? request : new Request(request);
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as typeof fetch;

    try {
      await proxyAuthRequest(
        new Request("http://localhost:3000/api/auth/callback/google?code=1", {
          headers: {
            referer: "https://accounts.google.com/",
          },
        }),
        "http://localhost:3001",
      );
    } finally {
      globalThis.fetch = previousFetch;
    }

    const forwardedRequest = captured.request;
    if (!forwardedRequest) throw new Error("Expected proxied request");

    expect(forwardedRequest.url).toBe(
      "http://localhost:3001/api/auth/callback/google?code=1",
    );
    expect(forwardedRequest.headers.get("x-forwarded-host")).toBe(
      "localhost:3000",
    );
    expect(forwardedRequest.headers.get("x-forwarded-proto")).toBe("http");
  });
});
