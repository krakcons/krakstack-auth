import { eq, isNull, or } from "drizzle-orm";

import { oauthClient } from "@/db/auth-schema";
import { db } from "@/services/database";
import {
  normalizeAuthHost,
  normalizeOAuthClientDomains,
  parseCsv,
} from "@/lib/domain-utils";

export { normalizeAuthHost, normalizeOAuthClientDomains, parseCsv };

export const hostFromRequest = (request: Request) =>
  normalizeAuthHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  ) ?? normalizeAuthHost(request.url);

const configuredPrimaryHosts = () => {
  const hosts = new Set<string>();

  const betterAuthHost = normalizeAuthHost(process.env.BETTER_AUTH_URL);
  if (betterAuthHost) hosts.add(betterAuthHost);

  if (process.env.NODE_ENV === "development") {
    hosts.add("localhost:3001");
    hosts.add("localhost:3000");
  }

  return hosts;
};

export const isPrimaryAuthHost = (host: string | null | undefined) =>
  Boolean(host && configuredPrimaryHosts().has(host));

const metadataDomains = (metadata: unknown) => {
  if (typeof metadata !== "object" || metadata === null) return [];
  const domains = Reflect.get(metadata, "domains");
  if (!Array.isArray(domains)) return [];
  return normalizeOAuthClientDomains(
    domains.filter((domain): domain is string => typeof domain === "string"),
  );
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
