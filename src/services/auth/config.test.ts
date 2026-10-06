import { describe, expect, it } from "@effect/vitest";
import { stripProxyOriginHeaders } from "@krak-stack/auth/server";

import { createAuth } from "./config";

describe.skipIf(!process.env.TEST_DATABASE_URL)("auth proxy base URL", () => {
  it("uses the validated consumer host for request-scoped API URLs", async () => {
    const auth = createAuth({
      allowedHosts: ["localhost:3001", "localhost:3004"],
    });
    const schema = await auth.api.generateOpenAPISchema({
      headers: new Headers({
        host: "localhost:3001",
        "x-forwarded-host": "localhost:3004",
        "x-forwarded-proto": "http",
      }),
    });

    expect(auth.options.advanced?.trustedProxyHeaders).toBe(true);
    expect(schema.servers).toEqual([
      {
        url: `${process.env.NODE_ENV === "development" ? "http" : "https"}://localhost:3004/api/auth`,
      },
    ]);
  });

  it("does not select a consumer host from stripped, untrusted forwarding headers", async () => {
    const auth = createAuth({
      allowedHosts: ["auth.example.com", "consumer.example.com"],
    });
    const incoming = new Request("https://auth.example.com/api/auth/ok", {
      headers: {
        host: "auth.example.com",
        "x-forwarded-host": "consumer.example.com",
        "x-forwarded-proto": "https",
      },
    });
    const schema = await auth.api.generateOpenAPISchema({
      headers: stripProxyOriginHeaders(incoming),
    });

    expect(schema.servers).toEqual([
      {
        url: `${process.env.NODE_ENV === "development" ? "http" : "https"}://auth.example.com/api/auth`,
      },
    ]);
  });
});
