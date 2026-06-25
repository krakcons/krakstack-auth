import { getDomain } from "tldts";
import { Cache, Duration, Effect, Exit } from "effect";

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

export const cookieDomainFromRequest = (request: Request) => {
  const host = hostFromRequest(request);
  if (!host) return undefined;

  const hostname = normalizeAuthHost(host)?.split(":")[0];
  if (!hostname) return undefined;

  const domain = getDomain(hostname);
  return domain ? `.${domain}` : undefined;
};

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

export const registeredAuthDomainForRequest = async (request: Request) => {
  const host = hostFromRequest(request);
  if (!host) return null;

  return await db.query.domains.findFirst({
    where: { hostname: host, active: true },
  });
};

export const isRegisteredAuthHost = async (request: Request) =>
  Boolean(await registeredAuthDomainForRequest(request));

const originForHost = (host: string, protocol: string) => {
  const normalized = normalizeAuthHost(host);
  if (!normalized) return null;
  const normalizedProtocol = protocol.replace(/:$/, "");

  return `${normalizedProtocol}://${normalized}`;
};

const activeDomainTrustedOriginsCacheKey = "active-domain-trusted-origins";

const activeDomainTrustedOriginsCache = Effect.runSync(
  Cache.makeWith<string, ReadonlyArray<string>, unknown, never, "lookup">(
    () =>
      Effect.promise(async () => {
        const rows = await db.query.domains.findMany({
          where: { active: true },
          columns: {
            hostname: true,
            rootHostname: true,
          },
        });

        const origins = new Set<string>();

        for (const domain of rows) {
          const authOrigin = originForHost(domain.hostname, "https:");
          const rootOrigin = originForHost(domain.rootHostname, "https:");
          if (authOrigin) origins.add(authOrigin);
          if (rootOrigin) origins.add(rootOrigin);
        }

        return Array.from(origins);
      }),
    {
      capacity: 1,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) ? Duration.seconds(60) : Duration.zero,
      requireServicesAt: "lookup",
    },
  ),
);

const activeDomainTrustedOrigins = () =>
  Effect.runPromise(
    Cache.get(
      activeDomainTrustedOriginsCache,
      activeDomainTrustedOriginsCacheKey,
    ),
  );

const defaultAllowedHosts = () => Array.from(configuredPrimaryHosts());

const activeDomainAllowedHosts = async () => {
  const hosts = new Set<string>();

  for (const origin of await activeDomainTrustedOrigins()) {
    const host = normalizeAuthHost(origin);
    if (host) hosts.add(host);
  }

  return Array.from(hosts);
};

export const allowedHostsForRequest = async (request?: Request) => {
  const hosts = new Set(defaultAllowedHosts());

  for (const host of await activeDomainAllowedHosts()) {
    hosts.add(host);
  }

  if (!request) return Array.from(hosts);

  const host = hostFromRequest(request);
  if (host && isPrimaryAuthHost(host)) hosts.add(host);

  const domain = await registeredAuthDomainForRequest(request);
  if (domain) {
    hosts.add(domain.hostname);
    hosts.add(domain.rootHostname);
  }

  return Array.from(hosts);
};

const requestProtocol = (request: Request) =>
  request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
  new URL(request.url).protocol.replace(":", "");

export const trustedOriginsForRequest = async (request?: Request) => {
  const origins = new Set(
    parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [],
  );

  for (const origin of await activeDomainTrustedOrigins()) {
    origins.add(origin);
  }

  if (!request) return Array.from(origins);

  const host = hostFromRequest(request);
  if (!host) return Array.from(origins);
  if (isPrimaryAuthHost(host)) {
    origins.add(new URL(request.url).origin);
  }

  const domain = await registeredAuthDomainForRequest(request);
  if (domain) {
    const protocol = requestProtocol(request);
    const authOrigin = originForHost(domain.hostname, protocol);
    const rootOrigin = originForHost(domain.rootHostname, protocol);
    if (authOrigin) origins.add(authOrigin);
    if (rootOrigin) origins.add(rootOrigin);
  }

  return Array.from(origins);
};
