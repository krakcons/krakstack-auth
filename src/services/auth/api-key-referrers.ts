import { Option, Schema } from "effect";

const Metadata = Schema.Record(Schema.String, Schema.Unknown);
const MetadataJson = Schema.fromJsonString(Metadata);
const AllowedOrigins = Schema.Array(Schema.String);
const decodeUrl = Schema.decodeUnknownOption(Schema.URLFromString);

export const apiKeyMetadata = (value: unknown): Record<string, unknown> => {
  const decoded =
    typeof value === "string"
      ? Schema.decodeUnknownOption(MetadataJson)(value)
      : Schema.decodeUnknownOption(Metadata)(value);

  return Option.getOrElse(decoded, () => ({}));
};

export const apiKeyAllowedOrigins = (value: unknown) => {
  const decoded = Schema.decodeUnknownOption(AllowedOrigins)(
    apiKeyMetadata(value).allowedOrigins,
  );
  return Option.getOrElse(decoded, () => []);
};

export const encodeApiKeyAllowedOrigins = (
  metadata: unknown,
  allowedOrigins: ReadonlyArray<string>,
) =>
  Schema.encodeSync(MetadataJson)({
    ...apiKeyMetadata(metadata),
    allowedOrigins: Array.from(allowedOrigins),
  });

const httpUrl = (value: string) => {
  const decoded = decodeUrl(value);
  if (Option.isNone(decoded)) return undefined;

  const url = decoded.value;
  return url.protocol === "http:" || url.protocol === "https:"
    ? url
    : undefined;
};

const origin = (value: string) => httpUrl(value)?.origin;

export const parseApiKeyReferrers = (value: string, errorMessage: string) => {
  const referrers = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const url = httpUrl(item);
      if (!url) throw new Error(errorMessage.replace("{referrer}", item));
      return url.origin;
    });

  return Array.from(new Set(referrers));
};

export const requestMatchesAllowedOrigins = (
  requestOrigin: string | undefined,
  requestReferrer: string | undefined,
  allowedOrigins: ReadonlyArray<string>,
) => {
  if (allowedOrigins.length === 0) return true;

  const sourceOrigin = origin(requestOrigin ?? requestReferrer ?? "");
  return Boolean(
    sourceOrigin &&
    allowedOrigins.some(
      (allowedOrigin) => origin(allowedOrigin) === sourceOrigin,
    ),
  );
};
