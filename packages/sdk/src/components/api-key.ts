import { Schema } from "effect";

import {
  ExtraCreateApiKeyPayload,
  ExtraCreateApiKeyResponse,
} from "../extra/schema";

export type CreateApiKeyPayload = typeof ExtraCreateApiKeyPayload.Type;
export type CreatedApiKey = typeof ExtraCreateApiKeyResponse.Type;

const ErrorResponse = Schema.Struct({ message: Schema.String });

const errorMessage = async (value: unknown, fallback: string) =>
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
