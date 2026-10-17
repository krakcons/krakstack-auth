import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { defaultStringifySearch } from "@tanstack/react-router";

import {
  passwordResetResendSeconds,
  passwordResetSearch,
  passwordResetConfirmation,
  passwordResetConfirmationSearch,
  passwordResetCallbackUrl,
  requestPasswordResetEmail,
} from "./password-reset.js";

describe("password reset page state", () => {
  it("keeps direct visits on the request form even when the email is known", () => {
    expect(passwordResetConfirmation("")).toBeNull();
    expect(passwordResetConfirmation("?email=user%40example.com")).toBeNull();
  });

  it("restores confirmation and cooldown from the URL without sending another email", () => {
    const query = defaultStringifySearch(
      passwordResetConfirmationSearch(
        "?client_id=client&state=oauth-state&callbackURL=%2Fprojects&token=old&error=INVALID_TOKEN",
        "user@example.com",
        1000,
      ),
    );
    const confirmation = passwordResetConfirmation(query, 1500);
    expect(confirmation).toEqual({
      email: "user@example.com",
      resetSentAt: 1000,
    });
    expect(passwordResetConfirmation(query, 2000)).toEqual(confirmation);
    expect(passwordResetResendSeconds(confirmation!.resetSentAt, 2000)).toBe(
      59,
    );
    expect(passwordResetSearch(query)).toEqual({
      email: "user@example.com",
      method: "password",
      client_id: "client",
      state: "oauth-state",
      callbackURL: "/projects",
    });
  });

  it("accepts already-generated links whose timestamp was serialized as a string", () => {
    const query = defaultStringifySearch({
      email: "user@example.com",
      resetSentAt: "1000",
    });
    expect(new URLSearchParams(query).get("resetSentAt")).toBe('"1000"');
    expect(passwordResetConfirmation(query, 2000)).toEqual({
      email: "user@example.com",
      resetSentAt: 1000,
    });
  });

  it.each(["invalid", "0", "-1", "Infinity", "1000.5", "2001"])(
    "rejects an invalid or future confirmation timestamp %s",
    (timestamp) => {
      expect(
        passwordResetConfirmation(
          `?email=user%40example.com&resetSentAt=${timestamp}`,
          2000,
        ),
      ).toBeNull();
    },
  );

  it("rejects confirmation for an invalid email", () => {
    expect(
      passwordResetConfirmation("?email=invalid&resetSentAt=1000", 2000),
    ).toBeNull();
  });

  it("preserves the return context in email links without stale reset state", () => {
    const url = new URL(
      passwordResetCallbackUrl(
        "?email=old%40example.com&resetSentAt=1000&token=old&error=INVALID_TOKEN&client_id=client&state=oauth-state&callbackURL=%2Fprojects",
        "https://consumer.example.com",
        "new@example.com",
      ),
    );
    expect(url.origin).toBe("https://consumer.example.com");
    expect(url.pathname).toBe("/reset-password");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      email: "new@example.com",
      method: "password",
      client_id: "client",
      state: "oauth-state",
      callbackURL: "/projects",
    });
  });
});

describe("password reset email requests", () => {
  it.effect(
    "sends the known email directly without signing out or changing the password",
    () =>
      Effect.gen(function* () {
        const requests: Request[] = [];
        const capture: typeof fetch = async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ status: true, message: "Check your email" });
        };

        yield* requestPasswordResetEmail({
          baseUrl: "https://auth.example.com",
          locale: () => "fr",
          email: "user@example.com",
          redirectTo: "https://consumer.example.com/reset-password",
        }).pipe(Effect.provideService(FetchHttpClient.Fetch, capture));

        expect(requests).toHaveLength(1);
        const request = requests[0]!;
        expect(request.url).toBe(
          "https://auth.example.com/api/auth/request-password-reset",
        );
        expect(request.method).toBe("POST");
        expect(request.credentials).toBe("include");
        expect(request.headers.get("accept-language")).toBe("fr");
        expect(yield* Effect.promise(() => request.text())).toBe(
          JSON.stringify({
            email: "user@example.com",
            redirectTo: "https://consumer.example.com/reset-password",
          }),
        );
      }),
  );

  it.effect(
    "preserves a failed send so callers do not show a success confirmation",
    () =>
      Effect.gen(function* () {
        const reject: typeof fetch = async () =>
          Response.json(
            {
              code: "TOO_MANY_REQUESTS",
              message: "Too many requests",
            },
            { status: 429 },
          );

        const error = yield* requestPasswordResetEmail({
          baseUrl: "https://auth.example.com",
          locale: () => "en",
          email: "user@example.com",
          redirectTo: "https://consumer.example.com/reset-password",
        }).pipe(
          Effect.provideService(FetchHttpClient.Fetch, reject),
          Effect.flip,
        );

        expect(error._tag).toBe("AuthTooManyRequests");
      }),
  );
});

describe("password reset resend cooldown", () => {
  it("allows an initial request and waits a full minute after a successful send", () => {
    expect(passwordResetResendSeconds(null, 1000)).toBe(0);
    expect(passwordResetResendSeconds(1000, 1000)).toBe(60);
    expect(passwordResetResendSeconds(1000, 60_999)).toBe(1);
    expect(passwordResetResendSeconds(1000, 61_000)).toBe(0);
    expect(passwordResetResendSeconds(1000, 90_000)).toBe(0);
  });
});
