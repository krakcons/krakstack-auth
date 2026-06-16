import { parseCsv } from "@/lib/domain-utils";

export { parseCsv };

export const trustedOrigins =
  parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [];
