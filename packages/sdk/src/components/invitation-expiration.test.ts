import { describe, expect, it } from "@effect/vitest";

import {
  invitationDisplayStatus,
  isInvitationExpired,
} from "./invitation-expiration";

const now = new Date("2026-07-15T12:00:00.000Z").getTime();

describe("invitation expiration", () => {
  it("keeps future pending invitations pending", () => {
    const invitation = {
      status: "pending",
      expiresAt: new Date("2026-07-15T12:00:01.000Z"),
    };

    expect(isInvitationExpired(invitation, now)).toBe(false);
    expect(invitationDisplayStatus(invitation, now)).toBe("pending");
  });

  it("expires pending invitations at the expiration boundary", () => {
    const invitation = {
      status: "pending",
      expiresAt: new Date(now),
    };

    expect(isInvitationExpired(invitation, now)).toBe(true);
    expect(invitationDisplayStatus(invitation, now)).toBe("expired");
  });

  it("preserves terminal invitation statuses", () => {
    const invitation = {
      status: "accepted",
      expiresAt: new Date("2026-07-14T12:00:00.000Z"),
    };

    expect(isInvitationExpired(invitation, now)).toBe(false);
    expect(invitationDisplayStatus(invitation, now)).toBe("accepted");
  });
});
