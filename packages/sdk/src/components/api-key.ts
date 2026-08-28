import { Option, Schema } from "effect";

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
