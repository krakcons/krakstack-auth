import { Effect, Option, Schema } from "effect";

import { authHttpClient } from "./auth-client-api.js";
import type { KrakstackAuthLocale } from "./auth-provider.js";
import { EmailAddress } from "../schema.js";

export const passwordResetSearch = (searchString: string) => {
  const search = new URLSearchParams(searchString);
  for (const key of ["resetSentAt", "token", "error"]) search.delete(key);
  return Object.fromEntries(search);
};

export const passwordResetConfirmationSearch = (
  searchString: string,
  email: string,
  sentAt: number,
) => ({
  ...passwordResetSearch(searchString),
  method: "password",
  email,
  resetSentAt: sentAt,
});

export const passwordResetConfirmation = (
  searchString: string,
  now = Date.now(),
) => {
  const Timestamp = Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: now }),
  ).annotate({ identifier: "PasswordResetTimestamp" });
  const Confirmation = Schema.Struct({
    email: EmailAddress,
    // Routers may JSON-quote numeric strings to preserve their string type.
    resetSentAt: Schema.Union([Timestamp, Schema.fromJsonString(Timestamp)]),
  }).annotate({ identifier: "PasswordResetConfirmation" });
  return Option.getOrNull(
    Schema.decodeUnknownOption(Confirmation)(
      Object.fromEntries(new URLSearchParams(searchString)),
    ),
  );
};

export const passwordResetCallbackUrl = (
  searchString: string,
  origin: string,
  email?: string,
) => {
  const url = new URL("/reset-password", origin);
  url.search = new URLSearchParams(
    passwordResetSearch(searchString),
  ).toString();
  if (email !== undefined) {
    url.searchParams.set("email", email);
    url.searchParams.set("method", "password");
  }
  return url.href;
};

export const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60_000;

export const passwordResetResendSeconds = (
  sentAt: number | null,
  now: number,
) =>
  sentAt === null
    ? 0
    : Math.max(
        0,
        Math.ceil((sentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS - now) / 1000),
      );

export const requestPasswordResetEmail = ({
  baseUrl,
  locale,
  email,
  redirectTo,
}: {
  baseUrl?: string | undefined;
  locale: () => KrakstackAuthLocale;
  email: string;
  redirectTo: string;
}) =>
  authHttpClient(baseUrl, locale).pipe(
    Effect.flatMap((client) =>
      client.auth.requestPasswordReset({ payload: { email, redirectTo } }),
    ),
  );

export const resetPasswordAndSignOut = ({
  baseUrl,
  locale,
  newPassword,
  token,
}: {
  baseUrl?: string | undefined;
  locale: () => KrakstackAuthLocale;
  newPassword: string;
  token: string;
}) =>
  authHttpClient(baseUrl, locale).pipe(
    Effect.flatMap((client) =>
      client.auth.resetPassword({ payload: { newPassword, token } }).pipe(
        // Server-side session revocation does not clear browser session cookies.
        Effect.flatMap(() => client.auth.signOut({ payload: {} })),
      ),
    ),
  );
