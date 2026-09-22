import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { authHttpClient } from "./auth-client-api.js";

describe("auth email request locale", () => {
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
