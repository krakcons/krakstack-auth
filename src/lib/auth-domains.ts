import { getDomain } from "tldts";

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

  return `${protocol}//${normalized}`;
};

const requestProtocol = (request: Request) =>
  request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
  new URL(request.url).protocol.replace(":", "");

export const trustedOriginsForRequest = async (request?: Request) => {
  const origins = new Set(
    parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [],
  );

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
