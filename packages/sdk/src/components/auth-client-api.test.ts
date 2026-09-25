import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { authHttpClient } from "./auth-client-api.js";
import { AuthTooManyRequests } from "../auth/schema.js";

describe("auth email request locale", () => {
  it.effect("preserves typed authentication failures", () =>
    Effect.gen(function* () {
      const respondWithRateLimit: typeof fetch = async () =>
        Response.json(
          { code: "TOO_MANY_REQUESTS", message: "Too many requests" },
          { status: 429 },
        );
      const client = yield* authHttpClient("https://auth.example.com");

      const error = yield* client.auth
        .signInEmail({
          payload: {
            email: "user@example.com",
            password: "incorrect",
          },
        })
        .pipe(
          Effect.provideService(FetchHttpClient.Fetch, respondWithRateLimit),
          Effect.flip,
        );

      expect(error).toBeInstanceOf(AuthTooManyRequests);
    }),
  );

  it.effect("sends JSON bodies for empty Better Auth actions", () =>
    Effect.gen(function* () {
      const requests: Request[] = [];
      const capture: typeof fetch = async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({}, { status: 500 });
      };
      const client = yield* authHttpClient("https://auth.example.com");

      yield* client.auth
        .adminStopImpersonating({ payload: {} })
        .pipe(
          Effect.provideService(FetchHttpClient.Fetch, capture),
          Effect.exit,
        );
      yield* client.auth
        .signOut({ payload: {} })
        .pipe(
          Effect.provideService(FetchHttpClient.Fetch, capture),
          Effect.exit,
        );

      expect(requests).toHaveLength(2);
      expect(
        requests.every(
          (request) =>
            request.headers.get("content-type") === "application/json",
        ),
      ).toBe(true);
      expect(
        yield* Effect.promise(() =>
          Promise.all(requests.map((request) => request.text())),
        ),
      ).toEqual(["{}", "{}"]);
    }),
  );

  it.effect(
    "reads the latest language for requests from an existing client",
    () =>
      Effect.gen(function* () {
        let locale: "en" | "fr" = "en";
        const languages: Array<string | null> = [];
        const capture: typeof fetch = async (input, init) => {
          languages.push(
            new Request(input, init).headers.get("accept-language"),
          );
          return Response.json({ success: true, status: true });
        };
        const client = yield* authHttpClient(
          "https://auth.example.com",
          () => locale,
        );
        const sendCode = client.auth
          .sendVerificationOtp({
            payload: { email: "locale@example.com", type: "sign-in" },
          })
          .pipe(Effect.provideService(FetchHttpClient.Fetch, capture));

        yield* sendCode;
        locale = "fr";
        yield* sendCode;
        yield* client.auth
          .twoFactorSendOtp({ payload: {} })
          .pipe(Effect.provideService(FetchHttpClient.Fetch, capture));
        expect(languages).toEqual(["en", "fr", "fr"]);
      }),
  );

  it.effect(
    "sends the selected site language for initial and resent codes",
    () =>
      Effect.gen(function* () {
        const requests: Request[] = [];
        const capture: typeof fetch = async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ success: true });
        };

        for (const locale of ["fr", "fr", "en"] as const) {
          const client = yield* authHttpClient(
            "https://auth.example.com",
            () => locale,
          );
          yield* client.auth
            .sendVerificationOtp({
              payload: { email: "locale@example.com", type: "sign-in" },
            })
            .pipe(Effect.provideService(FetchHttpClient.Fetch, capture));
        }

        expect(
          requests.map((request) => request.headers.get("accept-language")),
        ).toEqual(["fr", "fr", "en"]);
        expect(
          requests.every((request) => request.credentials === "include"),
        ).toBe(true);
      }),
  );
});
