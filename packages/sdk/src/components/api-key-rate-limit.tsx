import type { AuthApiKey as ApiKey } from "../auth/schema.js";

import { Badge } from "@/components/ui/badge";

type ApiKeyRateLimitMessages = {
  disabled: string;
  none: string;
  unlimited: string;
  usage: string;
  windowDays: (count: number) => string;
  windowHours: (count: number) => string;
  windowMinutes: (count: number) => string;
  windowSeconds: (count: number) => string;
};

type ApiKeyRateLimitValue = Pick<
  ApiKey,
  "rateLimitEnabled" | "rateLimitMax" | "rateLimitTimeWindow" | "requestCount"
>;

export const apiKeyUsagePercent = (keyData: ApiKeyRateLimitValue) => {
  if (!keyData.rateLimitMax) return 0;
  return Math.min(
    100,
    Math.round((keyData.requestCount / keyData.rateLimitMax) * 100),
  );
};

const formatWindow = (
  value: number | null,
  messages: ApiKeyRateLimitMessages,
) => {
  if (!value) return messages.none;

  const seconds = Math.round(value / 1000);
  if (seconds % 86400 === 0) return messages.windowDays(seconds / 86400);
  if (seconds % 3600 === 0) return messages.windowHours(seconds / 3600);
  if (seconds % 60 === 0) return messages.windowMinutes(seconds / 60);
  return messages.windowSeconds(seconds);
};

export const ApiKeyRateLimit = ({
  keyData,
  messages,
}: {
  keyData: ApiKeyRateLimitValue;
  messages: ApiKeyRateLimitMessages;
}) => {
  if (!keyData.rateLimitEnabled) {
    return <Badge variant="secondary">{messages.disabled}</Badge>;
  }

  if (!keyData.rateLimitMax) {
    return (
      <span className="text-muted-foreground text-sm">
        {messages.unlimited}
      </span>
    );
  }

  const percent = apiKeyUsagePercent(keyData);

  return (
    <div className="min-w-28 space-y-1">
      <div className="text-muted-foreground flex justify-between gap-2 text-xs">
        <span>
          {keyData.requestCount}/{keyData.rateLimitMax}
        </span>
        <span>{percent}%</span>
      </div>
      <div
        aria-label={messages.usage}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {formatWindow(keyData.rateLimitTimeWindow, messages)}
      </p>
    </div>
  );
};
