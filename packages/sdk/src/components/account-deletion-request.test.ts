import { describe, expect, it } from "@effect/vitest";
import { mockFetch } from "../../test/fetch.js";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { requestAccountDeletion } from "./account-deletion-request.js";

describe("Account deletion request", () => {
  it.effect(
    "omits an empty password and preserves a supplied password on the wire",
    () =>
      Effect.gen(function* () {
        const requests: Request[] = [];
        const capture: typeof fetch = mockFetch(async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ success: true, message: "User deleted" });
        });

        for (const password of ["", " password with spaces "]) {
          yield* requestAccountDeletion(
            password,
            "https://auth.example.com",
          ).pipe(Effect.provideService(FetchHttpClient.Fetch, capture));
        }

        expect(
          yield* Effect.promise(() =>
            Promise.all(requests.map((request) => request.text())),
          ),
        ).toEqual(["{}", '{"password":" password with spaces "}']);
        expect(
          requests.every(
            (request) =>
              new URL(request.url).pathname === "/api/auth/delete-user" &&
              request.credentials === "include",
          ),
        ).toBe(true);
      }),
  );
});
