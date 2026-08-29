import { and, eq, inArray, ne } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { CredentialsFromEnv } from "@distilled.cloud/cloudflare";
import * as CustomHostnames from "@distilled.cloud/cloudflare/custom-hostnames";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import { domains, organization, project } from "@/db/schema";
import {
  cookieDomainForAuthDomainContext,
  normalizeAuthHost,
  normalizeOAuthClientDomains,
  parseCsv,
} from "@/lib/domain-utils";
import { DB, runWithDatabase } from "@/services/database";
import type {
  ServerCreateDomainPayload,
  ServerDomain,
  ServerUpdateDomainPayload,
} from "@krak-stack/auth/server";

export { normalizeAuthHost, normalizeOAuthClientDomains, parseCsv };

export type AuthDomainContext = {
  readonly requestHost: string;
  readonly hosts: readonly string[];
  readonly origins: readonly string[];
  readonly cookieDomain: string | undefined;
};

const firstForwardedValue = (value: string | null) =>
  value?.split(",")[0]?.trim() || null;

export const hostFromRequest = (request: Request) =>
  normalizeAuthHost(
    firstForwardedValue(request.headers.get("x-forwarded-host")) ??
      request.headers.get("host"),
  ) ?? normalizeAuthHost(request.url);

const originHostFromRequest = (request: Request) =>
  normalizeAuthHost(
    request.headers.get("origin") ?? request.headers.get("referer"),
  );

const configuredPrimaryHosts = () => {
  const hosts = new Set<string>();

  const betterAuthHost = normalizeAuthHost(process.env.BETTER_AUTH_URL);
  if (betterAuthHost) hosts.add(betterAuthHost);

  for (const host of parseCsv(process.env.BETTER_AUTH_ADDITIONAL_HOSTS) ?? []) {
    const normalized = normalizeAuthHost(host);
    if (normalized) hosts.add(normalized);
  }

  if (process.env.NODE_ENV === "development") {
    hosts.add("localhost:3001");
    hosts.add("localhost:3000");
    hosts.add("auth.local.kokobi.test:3001");
  }

  return hosts;
};

export const isPrimaryAuthHost = (host: string | null | undefined) =>
  Boolean(host && configuredPrimaryHosts().has(host));

const originForHost = (host: string, protocol: string) => {
  const normalized = normalizeAuthHost(host);
  if (!normalized) return null;

  return `${protocol.replace(/:$/, "")}://${normalized}`;
};

const requestProtocol = (request: Request) =>
  firstForwardedValue(request.headers.get("x-forwarded-proto")) ??
  new URL(request.url).protocol.replace(":", "");

const hostLabels = (host: string) => host.split(":")[0]?.split(".") ?? [];

const sharedCookieDomain = (
  firstHost: string | null | undefined,
  secondHost: string | null | undefined,
) => {
  const first = firstHost ? hostLabels(firstHost) : [];
  const second = secondHost ? hostLabels(secondHost) : [];
  const common: string[] = [];

  while (first.length && second.length) {
    const firstLabel = first.pop();
    const secondLabel = second.pop();
    if (!firstLabel || firstLabel !== secondLabel) break;
    common.unshift(firstLabel);
  }

  return common.length >= 2 ? `.${common.join(".")}` : undefined;
};

const originsForHosts = (hosts: Iterable<string>, protocol: string) => {
  const origins = new Set<string>();

  for (const host of hosts) {
    const origin = originForHost(host, protocol);
    if (origin) origins.add(origin);
  }

  return Array.from(origins);
};

const cloudflareZoneId = () =>
  process.env.AUTH_CLOUDFLARE_ZONE_ID ?? process.env.CLOUDFLARE_ZONE_ID;

const CloudflareLive = Layer.mergeAll(
  FetchHttpClient.layer,
  CredentialsFromEnv,
);

const cnameTarget = () => {
  const configured = process.env.AUTH_DOMAIN_CNAME_TARGET;
  if (configured) return configured;

  const authUrl =
    process.env.VITE_KRAKSTACK_AUTH_URL ?? process.env.BETTER_AUTH_URL;
  if (!authUrl) return "auth.kokobi.org";

  try {
    return new URL(authUrl).hostname;
  } catch {
    return authUrl;
  }
};

const requireCloudflareZoneId = Effect.sync(() => {
  const zoneId = cloudflareZoneId();
  if (!zoneId) throw new Error("Auth Cloudflare zone ID is not configured");
  return zoneId;
});

type DomainRow = typeof domains.$inferSelect;

const normalizePayload = (payload: ServerCreateDomainPayload) => {
  const hostname = normalizeAuthHost(payload.hostname);
  const rootHostname = normalizeAuthHost(payload.rootHostname);
  if (!hostname || !rootHostname) return null;

  const projectId = payload.projectId?.trim() || null;
  const organizationId = payload.organizationId?.trim() || null;

  return {
    hostname,
    rootHostname,
    projectId,
    organizationId,
    managed: payload.managed,
  };
};

const normalizeUpdatePayload = (payload: ServerUpdateDomainPayload) => {
  const hostname = normalizeAuthHost(payload.hostname);
  const rootHostname = normalizeAuthHost(payload.rootHostname);
  if (!hostname || !rootHostname) return null;

  const projectId = payload.projectId?.trim() || null;
  const organizationId = payload.organizationId?.trim() || null;

  return {
    hostname,
    rootHostname,
    projectId,
    organizationId,
    managed: payload.managed,
  };
};

export class Domains extends Context.Service<Domains>()("Domains", {
  make: Effect.gen(function* () {
    const db = yield* DB;

    const enrichDomains = Effect.fn("Domains.enrichDomains")(function* (
      rows: readonly DomainRow[],
    ) {
      const projectIds = Array.from(
        new Set(rows.map((row) => row.projectId).filter((id) => id !== null)),
      );
      const organizationIds = Array.from(
        new Set(
          rows.map((row) => row.organizationId).filter((id) => id !== null),
        ),
      );

      const projects = projectIds.length
        ? yield* db
            .select({ id: project.id, name: project.name, logo: project.logo })
            .from(project)
            .where(inArray(project.id, projectIds))
        : [];
      const organizations = organizationIds.length
        ? yield* db
            .select({
              id: organization.id,
              name: organization.name,
              logo: organization.logo,
            })
            .from(organization)
            .where(inArray(organization.id, organizationIds))
        : [];
      const projectById = new Map(projects.map((item) => [item.id, item]));
      const organizationById = new Map(
        organizations.map((item) => [item.id, item]),
      );

      return rows.map((row) => {
        const linkedProject = row.projectId
          ? projectById.get(row.projectId)
          : undefined;
        const linkedOrganization = row.organizationId
          ? organizationById.get(row.organizationId)
          : undefined;

        return {
          ...row,
          projectName: linkedProject?.name ?? null,
          projectLogo: linkedProject?.logo ?? null,
          organizationName: linkedOrganization?.name ?? null,
          organizationLogo: linkedOrganization?.logo ?? null,
        } satisfies ServerDomain;
      });
    });

    const enrichDomain = Effect.fn("Domains.enrichDomain")(function* (
      row: DomainRow | null,
    ) {
      if (!row) return null;
      const [domain] = yield* enrichDomains([row]);
      return domain ?? null;
    });

    const get = Effect.fn("Domains.get")(function* ({ id }: { id: string }) {
      const domain = yield* db.query.domains.findFirst({ where: { id } });
      return yield* enrichDomain(domain ?? null);
    });

    const refreshStatus = Effect.fn("Domains.refreshStatus")(function* (
      domain: DomainRow,
    ) {
      if (!domain.managed) return domain;

      const zoneId = yield* requireCloudflareZoneId;
      const cloudflare = yield* CustomHostnames.getCustomHostname({
        zoneId,
        customHostnameId: domain.hostnameId,
      });
      const active = cloudflare.status === "active";
      if (domain.active === active) return domain;

      const [updated] = yield* db
        .update(domains)
        .set({ active, updatedAt: new Date() })
        .where(eq(domains.id, domain.id))
        .returning();

      return updated ?? { ...domain, active };
    });

    const list = Effect.fn("Domains.list")(function* () {
      const rows = yield* db.query.domains.findMany({
        orderBy: { createdAt: "desc" },
      });
      const refreshed = yield* Effect.all(rows.map(refreshStatus), {
        concurrency: 4,
      });

      return yield* enrichDomains(refreshed);
    });

    const getByHost = Effect.fn("Domains.getByHost")(function* ({
      hostname,
    }: {
      hostname: string;
    }) {
      const normalized = normalizeAuthHost(hostname);
      if (!normalized) return null;
      const domain = yield* db.query.domains.findFirst({
        where: { hostname: normalized },
        orderBy: { createdAt: "asc" },
      });
      return domain ?? null;
    });

    const registeredForRequest = Effect.fn("Domains.registeredForRequest")(
      function* ({ request }: { request: Request }) {
        const host = hostFromRequest(request);
        if (!host) return null;

        const rows = yield* db.query.domains.findMany({
          where: { hostname: host, active: true },
          limit: 2,
        });
        return rows.length === 1 ? (rows[0] ?? null) : null;
      },
    );

    const registeredOriginForRequest = Effect.fn(
      "Domains.registeredOriginForRequest",
    )(function* ({ request }: { request: Request }) {
      const host = originHostFromRequest(request);
      if (!host) return null;

      const domain = yield* db.query.domains.findFirst({
        where: { rootHostname: host, active: true },
      });
      return domain ?? null;
    });

    const contextForRequest = Effect.fn("Domains.contextForRequest")(
      function* ({ request }: { request: Request }) {
        const requestHost = hostFromRequest(request);
        if (!requestHost) return null;

        const hosts = new Set<string>();
        const hostDomain = yield* registeredForRequest({ request });
        const originDomain = isPrimaryAuthHost(requestHost)
          ? yield* registeredOriginForRequest({ request })
          : null;
        const domain = hostDomain ?? originDomain;
        const isOriginDomain = !hostDomain && Boolean(originDomain);

        if (domain) {
          hosts.add(domain.hostname);
          hosts.add(domain.rootHostname);
        } else if (isPrimaryAuthHost(requestHost)) {
          hosts.add(requestHost);
        } else {
          return null;
        }

        const hostList = Array.from(hosts);

        return {
          requestHost,
          hosts: hostList,
          origins: originsForHosts(hostList, requestProtocol(request)),
          cookieDomain: cookieDomainForAuthDomainContext({
            isOriginDomain,
            sharedCookieDomain: sharedCookieDomain(
              domain?.hostname,
              domain?.rootHostname,
            ),
          }),
        } satisfies AuthDomainContext;
      },
    );

    const allowedHostsForRequest = Effect.fn("Domains.allowedHostsForRequest")(
      function* ({ request }: { request?: Request } = {}) {
        const hosts = new Set(configuredPrimaryHosts());
        if (!request) return Array.from(hosts);

        const context = yield* contextForRequest({ request });
        for (const host of context?.hosts ?? []) {
          hosts.add(host);
        }

        return Array.from(hosts);
      },
    );

    const trustedOriginsForRequest = Effect.fn(
      "Domains.trustedOriginsForRequest",
    )(function* ({ request }: { request?: Request } = {}) {
      const origins = new Set(
        parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [],
      );

      for (const origin of originsForHosts(configuredPrimaryHosts(), "https")) {
        origins.add(origin);
      }

      if (!request) return Array.from(origins);

      const context = yield* contextForRequest({ request });
      for (const origin of context?.origins ?? []) {
        origins.add(origin);
      }

      const originHost = normalizeAuthHost(request.headers.get("origin"));
      const originDomain = originHost
        ? yield* db.query.domains.findFirst({
            where: { rootHostname: originHost, active: true },
          })
        : null;
      if (originDomain) {
        for (const origin of originsForHosts(
          [originDomain.hostname, originDomain.rootHostname],
          requestProtocol(request),
        )) {
          origins.add(origin);
        }
      }

      return Array.from(origins);
    });

    const cookieDomainForRequest = Effect.fn("Domains.cookieDomainForRequest")(
      function* ({ request }: { request: Request }) {
        const context = yield* contextForRequest({ request });
        return context?.cookieDomain;
      },
    );

    const create = Effect.fn("Domains.create")(function* ({
      payload,
    }: {
      payload: ServerCreateDomainPayload;
    }) {
      const normalized = normalizePayload(payload);
      if (!normalized) return null;

      const linkedProject = normalized.projectId
        ? yield* db.query.project.findFirst({
            where: { id: normalized.projectId },
            columns: { id: true },
          })
        : null;
      if (normalized.projectId && !linkedProject) {
        throw new Error(`Project not found: ${normalized.projectId}`);
      }

      const existing = yield* db.query.domains.findFirst({
        where: {
          hostname: normalized.hostname,
          rootHostname: normalized.rootHostname,
        },
      });
      if (existing) {
        const [domain] = yield* db
          .update(domains)
          .set({
            projectId: linkedProject?.id ?? null,
            organizationId: normalized.organizationId,
            managed: normalized.managed,
            updatedAt: new Date(),
          })
          .where(eq(domains.id, existing.id))
          .returning();

        return yield* enrichDomain(
          domain ?? { ...existing, managed: normalized.managed },
        );
      }

      const hostSibling = yield* db.query.domains.findFirst({
        where: { hostname: normalized.hostname },
        orderBy: { createdAt: "asc" },
      });

      let hostnameId: string = hostSibling?.hostnameId ?? crypto.randomUUID();
      const active = hostSibling?.active ?? !normalized.managed;
      if (!hostSibling && normalized.managed) {
        const zoneId = yield* requireCloudflareZoneId;
        hostnameId = (yield* CustomHostnames.createCustomHostname({
          zoneId,
          hostname: normalized.hostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: { http2: "on", tls_1_3: "on", minTlsVersion: "1.2" },
          },
        })).id;
      }

      const [domain] = yield* db
        .insert(domains)
        .values({
          id: crypto.randomUUID(),
          hostname: normalized.hostname,
          rootHostname: normalized.rootHostname,
          projectId: linkedProject?.id ?? null,
          organizationId: normalized.organizationId,
          hostnameId,
          managed: normalized.managed,
          active,
        })
        .returning();

      return yield* enrichDomain(domain ?? null);
    });

    const update = Effect.fn("Domains.update")(function* ({
      id,
      payload,
    }: {
      id: string;
      payload: ServerUpdateDomainPayload;
    }) {
      const normalized = normalizeUpdatePayload(payload);
      if (!normalized) return null;

      const existing = yield* db.query.domains.findFirst({ where: { id } });
      if (!existing) return null;

      const hostnameChanged = existing.hostname !== normalized.hostname;
      if (hostnameChanged && existing.managed) {
        throw new Error("Managed domain hostnames cannot be changed");
      }

      if (
        hostnameChanged ||
        existing.rootHostname !== normalized.rootHostname
      ) {
        const conflicting = yield* db.query.domains.findFirst({
          where: {
            hostname: normalized.hostname,
            rootHostname: normalized.rootHostname,
          },
          columns: { id: true },
        });
        if (conflicting && conflicting.id !== id) {
          throw new Error(
            `Domain already exists: ${normalized.hostname} -> ${normalized.rootHostname}`,
          );
        }
      }

      const linkedProject = normalized.projectId
        ? yield* db.query.project.findFirst({
            where: { id: normalized.projectId },
            columns: { id: true },
          })
        : null;
      if (normalized.projectId && !linkedProject) {
        throw new Error(`Project not found: ${normalized.projectId}`);
      }

      let hostnameId: string = existing.hostnameId;
      let active = existing.active;

      const [hostSibling] = yield* db
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.hostname, normalized.hostname),
            ne(domains.id, existing.id),
          ),
        )
        .orderBy(domains.createdAt)
        .limit(1);

      if (hostSibling) {
        hostnameId = hostSibling.hostnameId;
        active = hostSibling.active;
      } else if (existing.managed !== normalized.managed) {
        if (normalized.managed) {
          const zoneId = yield* requireCloudflareZoneId;
          hostnameId = (yield* CustomHostnames.createCustomHostname({
            zoneId,
            hostname: normalized.hostname,
            ssl: {
              method: "http",
              type: "dv",
              settings: {
                http2: "on",
                tls_1_3: "on",
                minTlsVersion: "1.2",
              },
            },
          })).id;
          active = false;
        } else {
          const zoneId = yield* requireCloudflareZoneId;
          yield* CustomHostnames.deleteCustomHostname({
            zoneId,
            customHostnameId: existing.hostnameId,
          });
          hostnameId = crypto.randomUUID();
          active = true;
        }
      }

      const [domain] = yield* db
        .update(domains)
        .set({
          hostname: normalized.hostname,
          rootHostname: normalized.rootHostname,
          projectId: linkedProject?.id ?? null,
          organizationId: normalized.organizationId,
          hostnameId,
          managed: normalized.managed,
          active,
          updatedAt: new Date(),
        })
        .where(eq(domains.id, id))
        .returning();

      return yield* enrichDomain(domain ?? null);
    });

    const records = Effect.fn("Domains.records")(function* ({
      id,
    }: {
      id: string;
    }) {
      const domain = yield* db.query.domains.findFirst({ where: { id } });
      if (!domain) return null;
      if (!domain.managed) return [];

      const refreshed = yield* refreshStatus(domain);

      return [
        {
          required: true,
          status: refreshed.active ? "SUCCESS" : "PENDING",
          type: "CNAME",
          name: domain.hostname,
          value: cnameTarget(),
        },
      ];
    });

    const _delete = Effect.fn("Domains.delete")(function* ({
      id,
    }: {
      id: string;
    }) {
      const domain = yield* get({ id });
      if (!domain) return null;

      const [hostSibling] = yield* db
        .select({ id: domains.id })
        .from(domains)
        .where(
          and(
            eq(domains.hostnameId, domain.hostnameId),
            ne(domains.id, domain.id),
          ),
        )
        .limit(1);

      if (domain.managed && !hostSibling) {
        const zoneId = yield* requireCloudflareZoneId;
        yield* CustomHostnames.deleteCustomHostname({
          zoneId,
          customHostnameId: domain.hostnameId,
        });
      }

      yield* db
        .delete(domains)
        .where(
          and(eq(domains.id, id), eq(domains.hostnameId, domain.hostnameId)),
        );

      return domain;
    });

    return {
      list,
      create,
      update,
      get,
      getByHost,
      registeredForRequest,
      contextForRequest,
      allowedHostsForRequest,
      trustedOriginsForRequest,
      cookieDomainForRequest,
      records,
      delete: _delete,
    };
  }),
}) {
  static readonly baseLayer = Layer.effect(this, this.make).pipe(
    Layer.provide(CloudflareLive),
  );

  static readonly layer = this.baseLayer.pipe(Layer.provide(DB.layer));

  static readonly testLayer = Layer.effect(this, this.make).pipe(
    Layer.provideMerge(DB.testLayer),
  );
}

const runDomains = <A, E>(effect: Effect.Effect<A, E, Domains>) =>
  runWithDatabase(effect.pipe(Effect.provide(Domains.baseLayer)));

export const registeredAuthDomainForRequest = (request: Request) =>
  runDomains(
    Effect.gen(function* () {
      const domains = yield* Domains;
      return yield* domains.registeredForRequest({ request });
    }),
  );

export const authDomainContextForRequest = (request: Request) =>
  runDomains(
    Effect.gen(function* () {
      const domains = yield* Domains;
      return yield* domains.contextForRequest({ request });
    }),
  );

export const isRegisteredAuthHost = async (request: Request) =>
  Boolean(await registeredAuthDomainForRequest(request));

export const allowedHostsForRequest = (request?: Request) =>
  runDomains(
    Effect.gen(function* () {
      const domains = yield* Domains;
      return yield* domains.allowedHostsForRequest(
        request ? { request } : undefined,
      );
    }),
  );

export const trustedOriginsForRequest = (request?: Request) =>
  runDomains(
    Effect.gen(function* () {
      const domains = yield* Domains;
      return yield* domains.trustedOriginsForRequest(
        request ? { request } : undefined,
      );
    }),
  );

export const cookieDomainFromRequest = (request: Request) =>
  runDomains(
    Effect.gen(function* () {
      const domains = yield* Domains;
      return yield* domains.cookieDomainForRequest({ request });
    }),
  );
