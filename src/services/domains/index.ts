import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { CredentialsFromEnv } from "@distilled.cloud/cloudflare";
import * as CustomHostnames from "@distilled.cloud/cloudflare/custom-hostnames";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import { domains } from "@/db/auth-schema";
import { normalizeAuthHost } from "@/lib/domain-utils";
import { DB } from "@/services/database";
import type { ServerCreateDomainPayload } from "../../../packages/sdk/src/server/schema";

const localHostnameIdPrefix = "local:";
const externalHostnameIdPrefix = "external:";

const isLocalHostnameId = (hostnameId: string) =>
  hostnameId.startsWith(localHostnameIdPrefix);

const isExternalHostnameId = (hostnameId: string) =>
  hostnameId.startsWith(externalHostnameIdPrefix);

const isManagedHostnameId = (hostnameId: string) =>
  !isLocalHostnameId(hostnameId) && !isExternalHostnameId(hostnameId);

const hostnameWithoutPort = (host: string) => host.split(":")[0] ?? host;

const isDevelopmentLocalHostname = (host: string) => {
  const hostname = hostnameWithoutPort(host);
  return (
    process.env.NODE_ENV === "development" &&
    (hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".test"))
  );
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

const normalizePayload = (payload: ServerCreateDomainPayload) => {
  const hostname = normalizeAuthHost(payload.hostname);
  const rootHostname = normalizeAuthHost(payload.rootHostname);
  if (!hostname || !rootHostname) return null;

  const projectId = payload.projectId?.trim() || null;
  const organizationId = payload.organizationId?.trim() || null;
  if (!projectId && !organizationId) return null;

  return { hostname, rootHostname, projectId, organizationId };
};

export class Domains extends Context.Service<Domains>()("Domains", {
  make: Effect.gen(function* () {
    const db = yield* DB;

    const get = Effect.fn("Domains.get")(function* ({ id }: { id: string }) {
      return yield* db.query.domains.findFirst({ where: { id } });
    });

    const list = Effect.fn("Domains.list")(function* () {
      return yield* db.query.domains.findMany({
        orderBy: { createdAt: "desc" },
      });
    });

    const getByHost = Effect.fn("Domains.getByHost")(function* ({
      hostname,
    }: {
      hostname: string;
    }) {
      const normalized = normalizeAuthHost(hostname);
      if (!normalized) return null;
      return yield* db.query.domains.findFirst({
        where: { hostname: normalized },
      });
    });

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
        where: { hostname: normalized.hostname },
      });
      if (existing) {
        const [domain] = yield* db
          .update(domains)
          .set({
            rootHostname: normalized.rootHostname,
            projectId: linkedProject?.id ?? null,
            organizationId: normalized.organizationId,
            updatedAt: new Date(),
          })
          .where(eq(domains.id, existing.id))
          .returning();

        return domain ?? existing;
      }

      const managed = payload.managed !== false;
      const isLocal = isDevelopmentLocalHostname(normalized.hostname);
      let hostnameId = `${localHostnameIdPrefix}${crypto.randomUUID()}`;
      if (!managed) {
        hostnameId = `${externalHostnameIdPrefix}${crypto.randomUUID()}`;
      } else if (!isLocal) {
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
          active: isLocal || !managed,
        })
        .returning();

      return domain ?? null;
    });

    const records = Effect.fn("Domains.records")(function* ({
      id,
    }: {
      id: string;
    }) {
      const domain = yield* get({ id });
      if (!domain) return null;
      if (!isManagedHostnameId(domain.hostnameId)) return [];

      const zoneId = yield* requireCloudflareZoneId;
      const cloudflare = yield* CustomHostnames.getCustomHostname({
        zoneId,
        customHostnameId: domain.hostnameId,
      });
      const active = cloudflare.status === "active";
      if (domain.active !== active) {
        yield* db
          .update(domains)
          .set({ active, updatedAt: new Date() })
          .where(eq(domains.id, domain.id));
      }

      return [
        {
          required: true,
          status: active
            ? "SUCCESS"
            : (cloudflare.status ?? "UNKNOWN").toUpperCase(),
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

      if (isManagedHostnameId(domain.hostnameId)) {
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

    return { list, create, get, getByHost, records, delete: _delete };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DB.layer),
    Layer.provide(CloudflareLive),
  );

  static readonly testLayer = Layer.effect(this, this.make).pipe(
    Layer.provideMerge(DB.testLayer),
  );
}

export { isLocalHostnameId, isExternalHostnameId, isManagedHostnameId };
