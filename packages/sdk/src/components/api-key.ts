import { Option, Schema } from "effect";

import {
  ExtraCreateApiKeyPayload,
  ExtraCreateApiKeyResponse,
  ExtraOkResponse,
  ExtraUpdateApiKeyPayload,
} from "../extra/schema";

export type CreateApiKeyPayload = typeof ExtraCreateApiKeyPayload.Type;
export type CreatedApiKey = typeof ExtraCreateApiKeyResponse.Type;
export type UpdateApiKeyPayload = typeof ExtraUpdateApiKeyPayload.Type;

const decodeUrl = Schema.decodeUnknownOption(Schema.URLFromString);

export const parseApiKeyReferrers = (value: string, errorMessage: string) => {
  const referrers = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const decoded = decodeUrl(item);
      if (Option.isNone(decoded)) {
        throw new Error(errorMessage.replace("{referrer}", item));
      }

      const url = decoded.value;
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(errorMessage.replace("{referrer}", item));
      }
      return url.origin;
    });

  return Array.from(new Set(referrers));
};

const ErrorResponse = Schema.Struct({ message: Schema.String });

const errorMessage = async (
  value: typeof Schema.Unknown.Type,
  fallback: string,
) =>
  Schema.decodeUnknownPromise(ErrorResponse)(value)
    .then((error) => error.message)
    .catch(() => fallback);

export const createApiKey = async (
  payload: CreateApiKeyPayload,
  fallbackError: string,
): Promise<CreatedApiKey> => {
  const body = await Schema.decodeUnknownPromise(ExtraCreateApiKeyPayload)(
    payload,
  );
  const response = await fetch("/api/auth/create-api-key", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(await errorMessage(data, fallbackError));
  }

  return await Schema.decodeUnknownPromise(ExtraCreateApiKeyResponse)(data);
};

export const updateApiKey = async (
  payload: UpdateApiKeyPayload,
  fallbackError: string,
) => {
  const decoded = await Schema.decodeUnknownPromise(ExtraUpdateApiKeyPayload)(
    payload,
  );
  const response = await fetch(
    `/api/auth/api-key/${encodeURIComponent(decoded.keyId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        configId: decoded.configId,
        name: decoded.name,
        enabled: decoded.enabled,
        permissions: decoded.permissions,
        referrers: decoded.referrers,
      }),
    },
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(await errorMessage(data, fallbackError));
  }

  return await Schema.decodeUnknownPromise(ExtraOkResponse)(data);
};
