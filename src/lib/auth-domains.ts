import { eq, isNull, or } from "drizzle-orm";
import { Schema } from "effect";

import { oauthClient } from "@/db/auth-schema";
import { db } from "@/services/database";
import {
  normalizeAuthHost,
  normalizeOAuthClientDomains,
  parseCsv,
} from "@/lib/domain-utils";
import { OAuthClientMetadata } from "@/services/oauth/schema";

export { normalizeAuthHost, normalizeOAuthClientDomains, parseCsv };

export const hostFromRequest = (request: Request) =>
  normalizeAuthHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  ) ?? normalizeAuthHost(request.url);

const configuredPrimaryHosts = () => {
  const hosts = new Set<string>();

  const betterAuthHost = normalizeAuthHost(process.env.BETTER_AUTH_URL);
  if (betterAuthHost) hosts.add(betterAuthHost);

  for (const origin of parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ??
    []) {
    const host = normalizeAuthHost(origin);
    if (host) hosts.add(host);
  }

  if (process.env.NODE_ENV === "development") {
    hosts.add("localhost:3001");
    hosts.add("localhost:3000");
  }

  return hosts;
};

export const isPrimaryAuthHost = (host: string | null | undefined) =>
  Boolean(host && configuredPrimaryHosts().has(host));

const OAuthClientStoredMetadata = Schema.Union([
  OAuthClientMetadata,
  Schema.fromJsonString(OAuthClientMetadata),
]);
const decodeMetadata = Schema.decodeUnknownSync(OAuthClientStoredMetadata);

const metadataDomains = (metadata: unknown) => {
  try {
    return normalizeOAuthClientDomains(decodeMetadata(metadata).domains ?? []);
  } catch {
    return [];
  }
};

export const isOAuthClientAuthHost = async (host: string) => {
  const clients = await db
    .select({ metadata: oauthClient.metadata })
    .from(oauthClient)
    .where(or(eq(oauthClient.disabled, false), isNull(oauthClient.disabled)));

  return clients.some((client) =>
    metadataDomains(client.metadata).includes(host),
  );
};

export const isAuthorizedAuthHost = async (request: Request) => {
  const host = hostFromRequest(request);
  if (!host) return false;
  if (isPrimaryAuthHost(host)) return true;
  return isOAuthClientAuthHost(host);
};

export const trustedOriginsForRequest = async (request?: Request) => {
  const origins = new Set(
    parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [],
  );

  if (!request) return Array.from(origins);

  const host = hostFromRequest(request);
  if (!host) return Array.from(origins);
  if (isPrimaryAuthHost(host) || (await isOAuthClientAuthHost(host))) {
    origins.add(new URL(request.url).origin);
  }

  return Array.from(origins);
};
