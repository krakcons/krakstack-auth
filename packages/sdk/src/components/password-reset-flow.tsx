import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { AtomRegistry } from "effect/reactivity";
import { Loader2 } from "lucide-react";
import { useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { authClientApi } from "./auth-client-api.js";
import {
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  passwordResetResendSeconds,
  requestPasswordResetEmail,
} from "./password-reset.js";

type PasswordResetRequest = Omit<
  Parameters<typeof requestPasswordResetEmail>[0],
  "baseUrl"
> & {
  onSent?: (sentAt: number) => void | Promise<void>;
};

// The caller owns routing and confirmation visibility. A mounted flow never
// sends automatically, including when its initial timestamp came from a URL.
export const usePasswordResetRequest = (
  baseUrl?: string,
  initialSentAt: number | null = null,
) => {
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [action] = useState(() =>
    authClientApi(baseUrl).runtime.fn((input: PasswordResetRequest) =>
      requestPasswordResetEmail({ baseUrl, ...input }).pipe(
        Effect.flatMap(() =>
          Effect.sync(() => {
            const sentAt = Date.now();
            setLastSentAt(sentAt);
            setNow(sentAt);
            return sentAt;
          }),
        ),
        Effect.tap((sentAt) =>
          Effect.promise(async () => {
            await input.onSent?.(sentAt);
          }),
        ),
      ),
    ),
  );
  const send = useAtomSet(action);
  const result = useAtomValue(action);
  const registry = useContext(RegistryContext);
  const request = (input: PasswordResetRequest) =>
    Effect.sync(() => registry.set(action, input)).pipe(
      Effect.flatMap(() =>
        AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }),
      ),
    );
  const sentAt = Math.max(initialSentAt ?? 0, lastSentAt ?? 0) || null;

  useEffect(() => {
    if (sentAt === null) return;
    const update = () => setNow(Date.now());
    update();
    if (Date.now() >= sentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS) return;
    const timer = window.setInterval(() => {
      update();
      if (Date.now() >= sentAt + PASSWORD_RESET_RESEND_COOLDOWN_MS) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);

  return {
    send,
    request,
    result,
    resendSeconds: passwordResetResendSeconds(sentAt, now),
  };
};

export const PasswordResetFeedback = ({
  pending,
  sendingLabel,
  error,
}: {
  pending: boolean;
  sendingLabel: string;
  error: ReactNode;
}) =>
  pending ? (
    <p role="status" className="text-muted-foreground text-sm">
      {sendingLabel}
    </p>
  ) : (
    <>{error}</>
  );

export const PasswordResetActions = ({
  pending,
  resendSeconds,
  onResend,
  resendLabel,
  countdownLabel,
}: {
  pending: boolean;
  resendSeconds: number;
  onResend: () => void;
  resendLabel: string;
  countdownLabel: (seconds: number) => string;
}) => (
  <div className="flex flex-wrap gap-2">
    <Button
      type="button"
      disabled={pending || resendSeconds > 0}
      onClick={onResend}
    >
      {pending ? (
        <Loader2 className="animate-spin" data-icon="inline-start" />
      ) : null}
      {resendSeconds > 0 ? countdownLabel(resendSeconds) : resendLabel}
    </Button>
  </div>
);
