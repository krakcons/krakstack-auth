import { Context, Effect, Layer, Schema } from "effect";
import { eq } from "drizzle-orm";

import { oauthClient, project } from "@/db/auth-schema";
import {
  normalizeAuthHost,
  normalizeOAuthClientDomains,
} from "@/lib/domain-utils";
import { DB } from "@/services/database";
import { sanitizeThemeCss } from "@/services/oauth/theme";

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
  google: googleConfigured && (data.authOptions?.google ?? true),
  signUp: data.authOptions?.signUp ?? true,
  signUpName: data.authOptions?.signUpName ?? true,
});

const StoredProjectData = Schema.Struct({
  authDomain: Schema.optional(Schema.String),
  domains: Schema.optional(Schema.Array(Schema.String)),
  rootDomain: Schema.optional(Schema.String),
  branding: ProjectData.fields.branding,
  authOptions: ProjectData.fields.authOptions,
});

export const decodeProjectData = (value: unknown) => {
  const stored = Schema.decodeUnknownSync(StoredProjectData)(
    value ?? emptyData,
  );
  const authDomain =
    normalizeAuthHost(stored.authDomain) ??
    normalizeOAuthClientDomains(stored.domains ?? [])[0];
  const rootDomain = normalizeAuthHost(stored.rootDomain);

  return Schema.decodeUnknownSync(ProjectData)({
    ...(authDomain ? { authDomain } : {}),
    ...(rootDomain ? { rootDomain } : {}),
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

export const authDomainFromData = (data: ProjectData) =>
  normalizeAuthHost(data.authDomain) ?? null;

const rootDomainFromData = (data: ProjectData) =>
  normalizeAuthHost(data.rootDomain) ?? null;

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

    const projectByHost = Effect.fn("Projects.projectByHost")(function* ({
      host,
    }: {
      host: string | null | undefined;
    }) {
      const normalizedHost = normalizeAuthHost(host);
      if (!normalizedHost) return null;

      const projects = yield* db.query.project.findMany();
      return (
        projects
          .map(row)
          .find((value) => authDomainFromData(value.data) === normalizedHost) ??
        null
      );
    });

    const publicConfigFrom = ({
      projectKey,
      value,
      client,
    }: {
      projectKey: string;
      value: ReturnType<typeof row> | null;
      client?: typeof oauthClient.$inferSelect;
    }) => {
      const data = value?.data ?? {};

      return {
        projectKey,
        name: value?.name ?? client?.name ?? null,
        logoUrl: value?.logo ?? client?.icon ?? null,
        authDomain: authDomainFromData(data),
        rootDomain: rootDomainFromData(data),
        themeCss: sanitizeThemeCss(data.branding?.themeCss, projectKey),
        authOptions: authOptions(data),
      };
    };

    const getPublicConfig = Effect.fn("Projects.getPublicConfig")(function* ({
      projectId,
      clientId,
      host,
    }: {
      projectId?: string | undefined;
      clientId?: string | undefined;
      host?: string | undefined;
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

      const hostProject = yield* projectByHost({ host });
      if (hostProject) {
        return publicConfigFrom({
          projectKey: normalizeAuthHost(host) ?? hostProject.id,
          value: hostProject,
        });
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
          slug: payload.slug.trim(),
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
          ...(payload.slug !== undefined ? { slug: payload.slug.trim() } : {}),
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
