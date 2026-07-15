import { useEffect, useState } from "react";

type ExpiringInvitation = {
  status: string;
  expiresAt: Date | string;
};

const expirationTime = (invitation: ExpiringInvitation) =>
  new Date(invitation.expiresAt).getTime();

export const isInvitationExpired = (
  invitation: ExpiringInvitation,
  now = Date.now(),
) => invitation.status === "pending" && expirationTime(invitation) <= now;

export const invitationDisplayStatus = (
  invitation: ExpiringInvitation,
  now = Date.now(),
) => (isInvitationExpired(invitation, now) ? "expired" : invitation.status);

export const useInvitationExpirationClock = (
  invitations: readonly ExpiringInvitation[],
) => {
  const [now, setNow] = useState(Date.now);
  const nextExpiration = invitations.reduce<number | undefined>(
    (next, invitation) => {
      const expiresAt = expirationTime(invitation);
      if (
        invitation.status !== "pending" ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= now
      ) {
        return next;
      }

      return next === undefined ? expiresAt : Math.min(next, expiresAt);
    },
    undefined,
  );

  useEffect(() => {
    if (nextExpiration === undefined) return;

    const delay = Math.min(
      Math.max(nextExpiration - Date.now() + 1, 0),
      2_147_483_647,
    );
    const timeout = globalThis.setTimeout(() => setNow(Date.now()), delay);
    return () => globalThis.clearTimeout(timeout);
  }, [nextExpiration]);

  return now;
};
