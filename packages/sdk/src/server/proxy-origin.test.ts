import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Redacted } from "effect";

import {
  authProxyKeyHeader,
  proxyOriginHeaders,
  readProxyOrigin,
  stripProxyOriginHeaders,
} from "./proxy-origin.js";

const apiKey = Redacted.make("svc_test-only-service-key");

describe("authenticated proxy context", () => {
  it.effect(
    "carries the original tenant with a separate redacted service credential",
    () =>
      Effect.gen(function* () {
        const original = new Request(
          "https://dev-test2.krakconsultants.net/api/auth/email-otp/send-verification-otp",
        );
        const headers = yield* proxyOriginHeaders(original, apiKey);
        headers.set("x-forwarded-host", "auth.krakstack.net");
        const request = new Request(
          "https://auth.krakstack.net/api/auth/email-otp/send-verification-otp",
          { headers },
        );
        const origin = Option.getOrThrow(yield* readProxyOrigin(request));
        expect(origin.host).toBe("dev-test2.krakconsultants.net");
        expect(origin.protocol).toBe("https");
        expect(Redacted.value(origin.apiKey)).toBe(Redacted.value(apiKey));
        expect(JSON.stringify(origin)).not.toContain(Redacted.value(apiKey));
      }),
  );

  for (const missing of [
    authProxyKeyHeader,
    "x-krakstack-forwarded-host",
    "x-krakstack-forwarded-proto",
  ]) {
    it.effect(`rejects missing ${missing}`, () =>
      Effect.gen(function* () {
        const headers = yield* proxyOriginHeaders(
          new Request("https://app.example.com"),
          apiKey,
        );
        headers.delete(missing);
        const error = yield* Effect.flip(
          readProxyOrigin(new Request("https://auth.example.com", { headers })),
        );
        expect(error.reason).toBe("invalid");
      }),
    );
  }

  it.effect(
    "strips proxy credentials and untrusted forwarding headers while preserving the user session",
    () =>
      Effect.gen(function* () {
        const headers = yield* proxyOriginHeaders(
          new Request("https://app.example.com"),
          apiKey,
        );
        headers.set("cookie", "session=user-session");
        headers.set("authorization", "Bearer user-token");
        headers.set("x-forwarded-host", "attacker.example.com");
        headers.set("forwarded", "host=attacker.example.com");
        const clean = stripProxyOriginHeaders(
          new Request("https://auth.example.com", { headers }),
        );
        expect(Object.fromEntries(clean)).toEqual({
          cookie: "session=user-session",
          authorization: "Bearer user-token",
        });
      }),
  );

  it.effect(
    "does not treat unsigned standard forwarding headers as authenticated context",
    () =>
      Effect.gen(function* () {
        const request = new Request("https://auth.example.com", {
          headers: { "x-forwarded-host": "app.example.com" },
        });
        expect(Option.isNone(yield* readProxyOrigin(request))).toBe(true);
        expect(Array.from(stripProxyOriginHeaders(request))).toEqual([]);
      }),
  );

  it.effect("rejects an empty configured service key", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        proxyOriginHeaders(
          new Request("https://app.example.com"),
          Redacted.make(""),
        ),
      );
      expect(error.reason).toBe("configuration");
    }),
  );
});
