import { Context, Effect, Layer, Schema } from "effect";
import { eq } from "drizzle-orm";

import { oauthClient, project } from "@/db/schema";
import { normalizeAuthHost } from "@/lib/domain-utils";
import { DB } from "@/services/database";
import { sanitizeThemeCss } from "@/services/oauth/theme";
import { organizationBranding } from "@/services/organizations/branding";

import {
  ProjectData,
  type CreateProjectPayload,
  type UpdateProjectPayload,
} from "./schema";

const emptyData: ProjectData = {};

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const authOptions = (data: ProjectData) => ({
  emailPassword: data.authOptions?.emailPassword ?? true,
  emailOtp: data.authOptions?.emailOtp ?? true,
  google: googleConfigured && (data.authOptions?.google ?? true),
});

const StoredProjectData = Schema.Struct({
  branding: ProjectData.fields.branding,
  authOptions: ProjectData.fields.authOptions,
});

export const decodeProjectData = (value: unknown) => {
  const stored = Schema.decodeUnknownSync(StoredProjectData)(
    value ?? emptyData,
  );

  return Schema.decodeUnknownSync(ProjectData)({
    ...(stored.branding ? { branding: stored.branding } : {}),
    ...(stored.authOptions ? { authOptions: stored.authOptions } : {}),
  });
};

export const decodeProjectDataOrEmpty = (value: unknown) => {
  try {
    return decodeProjectData(value);
  } catch {
    return emptyData;
  }
};

const row = (value: typeof project.$inferSelect) => ({
  ...value,
  logo: value.logo ?? null,
  data: decodeProjectDataOrEmpty(value.data),
});

const fallbackPublicConfig = (projectKey: string) => ({
  projectKey,
  name: null,
  logoUrl: null,
  authDomain: null,
  rootDomain: null,
  themeCss: null,
  authOptions: authOptions({}),
});

export class Projects extends Context.Service<Projects>()("Projects", {
  make: Effect.gen(function* () {
    const db = yield* DB;

    const list = Effect.fn("Projects.list")(function* () {
      const rows = yield* db.query.project.findMany({
        orderBy: { name: "asc" },
      });
      return rows.map(row);
    });

    const get = Effect.fn("Projects.get")(function* ({ id }: { id: string }) {
      const value = yield* db.query.project.findFirst({ where: { id } });
      return value ? row(value) : null;
    });

    const publicConfigFrom = ({
      projectKey,
      value,
      client,
      authDomain,
      rootDomain,
    }: {
      projectKey: string;
      value: ReturnType<typeof row> | null;
      client?: typeof oauthClient.$inferSelect;
      authDomain?: string | null;
      rootDomain?: string | null;
    }) => {
      const data = value?.data ?? {};

      return {
        projectKey,
        name: value?.name ?? client?.name ?? null,
        logoUrl: value?.logo ?? client?.icon ?? null,
        authDomain: authDomain ?? null,
        rootDomain: rootDomain ?? null,
        themeCss: sanitizeThemeCss(data.branding?.themeCss, projectKey),
        authOptions: authOptions(data),
      };
    };

    const getPublicConfig = Effect.fn("Projects.getPublicConfig")(function* ({
      projectId,
      clientId,
      host,
      rootHost,
    }: {
      projectId?: string | undefined;
      clientId?: string | undefined;
      host?: string | undefined;
      rootHost?: string | undefined;
    }) {
      if (projectId) {
        const value = yield* db.query.project.findFirst({
          where: { id: projectId },
        });
        if (value) {
          return publicConfigFrom({
            projectKey: value.id,
            value: row(value),
          });
        }
      }

      const normalizedHost = normalizeAuthHost(host);
      if (normalizedHost) {
        const normalizedRootHost = normalizeAuthHost(rootHost);
        const matchingDomains = yield* db.query.domains.findMany({
          where: normalizedRootHost
            ? {
                hostname: normalizedHost,
                rootHostname: normalizedRootHost,
                active: true,
              }
            : { hostname: normalizedHost, active: true },
          limit: 2,
        });
        const domain =
          matchingDomains.length === 1 ? (matchingDomains[0] ?? null) : null;
        if (domain) {
          const value = domain.projectId
            ? yield* db.query.project.findFirst({
                where: { id: domain.projectId },
              })
            : null;
          const organization = domain.organizationId
            ? yield* db.query.organization.findFirst({
                where: { id: domain.organizationId },
              })
            : null;
          const organizationDisplay = organizationBranding(
            organization ?? null,
          );
          const data = value ? row(value).data : {};
          const projectKey =
            [domain.projectId, domain.organizationId]
              .filter(Boolean)
              .join(":") || domain.hostname;

          return {
            projectKey,
            name: organizationDisplay?.name ?? value?.name ?? null,
            logoUrl: organizationDisplay?.logo ?? value?.logo ?? null,
            authDomain: domain.hostname,
            rootDomain: domain.rootHostname,
            themeCss: sanitizeThemeCss(data.branding?.themeCss, projectKey),
            authOptions: authOptions(data),
          };
        }
      }

      if (clientId) {
        const client = yield* db.query.oauthClient.findFirst({
          where: { clientId },
        });

        if (client && !client.disabled) {
          const value = client.projectId
            ? yield* db.query.project.findFirst({
                where: { id: client.projectId },
              })
            : null;

          return publicConfigFrom({
            projectKey: value?.id ?? client.clientId,
            value: value ? row(value) : null,
            client,
          });
        }
      }

      return fallbackPublicConfig(
        projectId ?? clientId ?? normalizeAuthHost(host) ?? "default",
      );
    });

    const create = Effect.fn("Projects.create")(function* ({
      payload,
    }: {
      payload: CreateProjectPayload;
    }) {
      const [value] = yield* db
        .insert(project)
        .values({
          id: crypto.randomUUID(),
          name: payload.name.trim(),
          logo: payload.logo ?? null,
          data: decodeProjectData(payload.data),
        })
        .returning();

      return value ? row(value) : null;
    });

    const update = Effect.fn("Projects.update")(function* ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProjectPayload;
    }) {
      const [value] = yield* db
        .update(project)
        .set({
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.logo !== undefined ? { logo: payload.logo } : {}),
          data: decodeProjectData(payload.data),
          updatedAt: new Date(),
        })
        .where(eq(project.id, id))
        .returning();

      return value ? row(value) : null;
    });

    const _delete = Effect.fn("Projects.delete")(function* ({
      id,
    }: {
      id: string;
    }) {
      const [value] = yield* db
        .delete(project)
        .where(eq(project.id, id))
        .returning();

      return value ? row(value) : null;
    });

    return { list, get, getPublicConfig, create, update, delete: _delete };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DB.layer),
  );
}
