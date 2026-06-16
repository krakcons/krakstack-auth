import { eq, isNull, or } from "drizzle-orm";
import { getDomain } from "tldts";

import { oauthClient, project } from "@/db/auth-schema";
import { db } from "@/services/database";
import {
  normalizeAuthHost,
  normalizeOAuthClientDomains,
  parseCsv,
} from "@/lib/domain-utils";
import { decodeProjectDataOrEmpty } from "@/services/projects";

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

const dataDomains = (data: unknown) =>
  normalizeOAuthClientDomains(decodeProjectDataOrEmpty(data).domains ?? []);

export const isOAuthClientAuthHost = async (host: string) => {
  const clients = await db
    .select({ data: project.data })
    .from(oauthClient)
    .leftJoin(project, eq(oauthClient.projectId, project.id))
    .where(or(eq(oauthClient.disabled, false), isNull(oauthClient.disabled)));

  return clients.some((client) => dataDomains(client.data).includes(host));
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
