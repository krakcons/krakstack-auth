import { describe, expect, it } from "@effect/vitest";

import { OrganizationImpersonationBodyStandard } from "./schema";

const body = {
  organizationId: "organization-1",
  actorUserId: "actor-1",
  targetUserId: "target-1",
};

const validate = OrganizationImpersonationBodyStandard["~standard"].validate;

describe("organization impersonation body", () => {
  it("accepts an omitted expiry and inclusive expiry bounds", async () => {
    expect(await validate(body)).toEqual({ value: body });
    for (const expiresInSeconds of [1, 60 * 60 * 24]) {
      const payload = { ...body, expiresInSeconds };
      expect(await validate(payload)).toEqual({ value: payload });
    }
  });

  it("rejects invalid expiries", async () => {
    for (const expiresInSeconds of [
      0,
      -1,
      1.5,
      86401,
      Infinity,
      NaN,
      "60",
      null,
    ]) {
      expect(
        (await validate({ ...body, expiresInSeconds })).issues,
      ).toBeDefined();
    }
  });

  it("requires non-empty identifiers", async () => {
    for (const field of ["organizationId", "actorUserId", "targetUserId"]) {
      for (const value of ["", undefined, null, 1]) {
        expect(
          (await validate({ ...body, [field]: value })).issues,
        ).toBeDefined();
      }
    }
  });

  it("strips unknown fields", async () => {
    expect(await validate({ ...body, unexpected: true })).toEqual({
      value: body,
    });
  });
});
