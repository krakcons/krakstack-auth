import { describe, expect, it } from "@effect/vitest";

import { proxyAuthRequest } from "./proxy.js";

interface CapturedRequest {
  request?: Request;
}

type FetchHandler = (
  request: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const mockFetch = (handler: FetchHandler): typeof fetch => {
  const implementation = (request: RequestInfo | URL, init?: RequestInit) =>
    handler(request, init);
  implementation.preconnect = globalThis.fetch.preconnect;
  return implementation;
};

describe("proxyAuthRequest", () => {
  it("forwards the proxied request host instead of the OAuth referer", async () => {
    const previousFetch = globalThis.fetch;
    const captured: CapturedRequest = {};

    globalThis.fetch = mockFetch((request) => {
      captured.request =
        request instanceof Request ? request : new Request(request);
      return Promise.resolve(new Response(null, { status: 204 }));
    });

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
    expect(forwardedRequest.headers.get("x-krakstack-forwarded-host")).toBe(
      "localhost:3000",
    );
    expect(forwardedRequest.headers.get("x-krakstack-forwarded-proto")).toBe(
      "http",
    );
  });

  it("replaces untrusted KrakStack forwarding headers", async () => {
    const previousFetch = globalThis.fetch;
    const captured: CapturedRequest = {};

    globalThis.fetch = mockFetch((request) => {
      captured.request =
        request instanceof Request ? request : new Request(request);
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    try {
      await proxyAuthRequest(
        new Request("https://template.krakstack.net/api/auth/sign-in/social", {
          headers: {
            "x-krakstack-forwarded-host": "attacker.example.com",
            "x-krakstack-forwarded-proto": "http",
          },
        }),
        "https://auth.krakstack.net",
      );
    } finally {
      globalThis.fetch = previousFetch;
    }

    expect(captured.request?.headers.get("x-krakstack-forwarded-host")).toBe(
      "template.krakstack.net",
    );
    expect(captured.request?.headers.get("x-krakstack-forwarded-proto")).toBe(
      "https",
    );
  });

  it("does not add OAuth origin headers to organization mutations", async () => {
    const previousFetch = globalThis.fetch;
    const captured: CapturedRequest = {};

    globalThis.fetch = mockFetch((request) => {
      captured.request =
        request instanceof Request ? request : new Request(request);
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    try {
      await proxyAuthRequest(
        new Request("http://localhost:3002/api/auth/organization/set-active", {
          method: "POST",
          headers: {
            "x-krakstack-forwarded-host": "attacker.example.com",
            "x-krakstack-forwarded-proto": "https",
          },
        }),
        "http://localhost:3001",
      );
    } finally {
      globalThis.fetch = previousFetch;
    }

    expect(captured.request?.headers.get("x-forwarded-host")).toBe(
      "localhost:3002",
    );
    expect(captured.request?.headers.get("x-krakstack-forwarded-host")).toBe(
      null,
    );
    expect(captured.request?.headers.get("x-krakstack-forwarded-proto")).toBe(
      null,
    );
  });

  it("returns upstream cookies as host-only cookies", async () => {
    const previousFetch = globalThis.fetch;

    globalThis.fetch = mockFetch(() => {
      const headers = new Headers();
      headers.append(
        "set-cookie",
        "session=one; Domain=krakstack.net; Path=/; HttpOnly; Secure",
      );
      headers.append(
        "set-cookie",
        "context=two; domain=.krakstack.net; Path=/; Secure",
      );
      return Promise.resolve(new Response(null, { status: 204, headers }));
    });

    try {
      const response = await proxyAuthRequest(
        new Request("https://dev.kokobi.org/api/auth/get-session"),
        "https://auth.krakstack.net",
      );

      expect(response.headers.getSetCookie()).toEqual([
        "session=one; Path=/; HttpOnly; Secure",
        "context=two; Path=/; Secure",
      ]);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("shares cookies across matching root-domain hosts", async () => {
    const previousFetch = globalThis.fetch;

    globalThis.fetch = mockFetch(() => {
      const headers = new Headers();
      headers.append(
        "set-cookie",
        "session=one; Domain=auth.kokobi.org; Path=/; HttpOnly; Secure",
      );
      headers.append(
        "set-cookie",
        "__Host-csrf=two; Domain=auth.kokobi.org; Path=/; Secure",
      );
      return Promise.resolve(new Response(null, { status: 204, headers }));
    });

    try {
      const response = await proxyAuthRequest(
        new Request("https://learning.kokobi.org/api/auth/get-session"),
        "https://auth.kokobi.org",
        { cookieDomain: ".Kokobi.org." },
      );

      expect(response.headers.getSetCookie()).toEqual([
        "session=one; Path=/; HttpOnly; Secure; Domain=kokobi.org",
        "__Host-csrf=two; Path=/; Secure",
      ]);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("keeps cookies host-only on unrelated tenant domains", async () => {
    const previousFetch = globalThis.fetch;

    globalThis.fetch = mockFetch(() => {
      const headers = new Headers({
        "set-cookie":
          "session=one; Domain=auth.kokobi.org; Path=/; HttpOnly; Secure",
      });
      return Promise.resolve(new Response(null, { status: 204, headers }));
    });

    try {
      const response = await proxyAuthRequest(
        new Request("https://learn.customer.com/api/auth/get-session"),
        "https://auth.kokobi.org",
        { cookieDomain: "kokobi.org" },
      );

      expect(response.headers.getSetCookie()).toEqual([
        "session=one; Path=/; HttpOnly; Secure",
      ]);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("does not request compressed upstream responses", async () => {
    const previousFetch = globalThis.fetch;
    const captured: CapturedRequest = {};

    globalThis.fetch = mockFetch((request) => {
      captured.request =
        request instanceof Request ? request : new Request(request);
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    try {
      await proxyAuthRequest(
        new Request("https://dev.kokobi.org/api/auth/get-session", {
          headers: { "accept-encoding": "gzip, br" },
        }),
        "https://auth.krakstack.net",
      );
    } finally {
      globalThis.fetch = previousFetch;
    }

    expect(captured.request?.headers.has("accept-encoding")).toBe(false);
  });
});
