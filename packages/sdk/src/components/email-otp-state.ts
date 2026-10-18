import { Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import { Atom } from "effect/reactivity";

export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_OTP_LIFETIME_MS = 5 * 60 * 1000;

const EmailOtpSends = Schema.Record(Schema.String, Schema.Number).annotate({
  identifier: "EmailOtpSends",
});

const storageRuntime = Atom.runtime(
  globalThis.window === undefined
    ? KeyValueStore.layerMemory
    : KeyValueStore.layerStorage(() => window.localStorage),
);

export const emailOtpSendsAtom = Atom.family((baseUrl: string) =>
  Atom.kvs({
    runtime: storageRuntime,
    key: `krakstack-auth:email-otp-sends:v1:${baseUrl}`,
    schema: EmailOtpSends,
    defaultValue: () => ({}),
  }),
);

export const emailOtpSendState = (sentAt: number | undefined, now: number) => ({
  reusable:
    sentAt !== undefined &&
    now >= sentAt &&
    now - sentAt < EMAIL_OTP_LIFETIME_MS,
  resendSeconds:
    sentAt === undefined
      ? 0
      : Math.max(
          0,
          Math.ceil(
            (sentAt + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000,
          ),
        ),
});
