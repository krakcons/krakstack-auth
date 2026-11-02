import { describe, expect, it } from "@effect/vitest";
import { mockFetch } from "../../test/fetch.js";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import {
  canDeleteOrganization,
  requestOrganizationDeletion,
} from "./organization-deletion-request.js";

describe("Organization switcher deletion", () => {
  it("offers deletion only to an owner of a non-personal organization", () => {
    const organization = {
      userId: null,
      members: [
        { userId: "owner", role: "owner,admin" },
        { userId: "admin", role: "admin" },
        { userId: "member", role: "member" },
      ],
    };
    expect(canDeleteOrganization(organization, "owner")).toBe(true);
    for (const userId of ["admin", "member", "outsider", undefined]) {
      expect(canDeleteOrganization(organization, userId)).toBe(false);
    }
    expect(
      canDeleteOrganization({ ...organization, userId: "owner" }, "owner"),
    ).toBe(false);
    expect(canDeleteOrganization(null, "owner")).toBe(false);
  });

  it.effect(
    "sends the confirmed organization ID to the authenticated deletion endpoint",
    () =>
      Effect.gen(function* () {
        const requests: Request[] = [];
        const capture: typeof fetch = mockFetch(async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({
            id: "confirmed-organization",
            name: "Organization",
            slug: "organization",
            logo: null,
            metadata: null,
            createdAt: "2026-11-01T00:00:00.000Z",
          });
        });
        yield* requestOrganizationDeletion(
          "confirmed-organization",
          "https://auth.example.com",
        ).pipe(Effect.provideService(FetchHttpClient.Fetch, capture));
        expect(requests).toHaveLength(1);
        const request = requests[0]!;
        expect(new URL(request.url).pathname).toBe(
          "/api/auth/organization/delete",
        );
        expect(request.method).toBe("POST");
        expect(request.credentials).toBe("include");
        expect(yield* Effect.promise(() => request.text())).toBe(
          '{"organizationId":"confirmed-organization"}',
        );
      }),
  );

  it.effect(
    "propagates deletion failure so the confirmation remains open",
    () =>
      Effect.gen(function* () {
        const reject: typeof fetch = mockFetch(async () =>
          Response.json({ message: "Forbidden" }, { status: 403 }),
        );
        const result = yield* requestOrganizationDeletion(
          "organization",
          "https://auth.example.com",
        ).pipe(
          Effect.provideService(FetchHttpClient.Fetch, reject),
          Effect.result,
        );
        expect(result._tag).toBe("Failure");
      }),
  );
});
