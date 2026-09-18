import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { stripProxyOriginHeaders } from "@krak-stack/auth/server";
import { withAuthRequestHeaders } from "./better-auth-request";

describe("authentication request body lifecycle", () => {
  for (const consumed of [false, true]) {
    it.effect(`preserves request context with consumed=${consumed}`, () =>
      Effect.gen(function* () {
        const request = new Request(
          "https://auth.example.com/api/auth/verify-api-key",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-host": "untrusted.example.com",
            },
            body: '{"key":"test-key"}',
          },
        );
        if (consumed) yield* Effect.promise(() => request.text());

        const restored = withAuthRequestHeaders(
          request,
          stripProxyOriginHeaders(request),
        );

        expect(restored.url).toBe(request.url);
        expect(restored.method).toBe("POST");
        expect(restored.headers.get("content-type")).toBe("application/json");
        expect(restored.headers.has("x-forwarded-host")).toBe(false);
        expect(yield* Effect.promise(() => restored.text())).toBe(
          consumed ? "" : '{"key":"test-key"}',
        );
      }),
    );
  }
});
