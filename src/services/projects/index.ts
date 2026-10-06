import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import {
  DomainRow,
  OAuthClientRow,
  OrganizationRow,
  ProjectRow,
} from "@/db/schema";
import { normalizeAuthHost } from "@/lib/domain-utils";
import { sqlLayer, sqlTestLayer } from "@/services/database";
import { sanitizeThemeCss } from "@/services/oauth/theme";
import { organizationBranding } from "@/services/organizations/branding";

import {
  ProjectData,
  ProjectDataJson,
  CreateProjectPayload,
  UpdateProjectPayload,
  UpdateProjectRequest,
  type ProjectSqlUpdate,
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

export const decodeProjectData = (value: typeof Schema.Unknown.Type) => {
  const stored = Schema.decodeUnknownSync(StoredProjectData)(
    value ?? emptyData,
  );

  let data: ProjectData = {};
  if (stored.branding) data = { ...data, branding: stored.branding };
  if (stored.authOptions) data = { ...data, authOptions: stored.authOptions };
  return Schema.decodeUnknownSync(ProjectData)(data);
};

export const decodeProjectDataOrEmpty = (value: typeof Schema.Unknown.Type) => {
  try {
    return decodeProjectData(value);
  } catch {
    return emptyData;
  }
};

const row = (value: typeof ProjectRow.Type) => ({
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
    const sql = yield* SqlClient.SqlClient;
    const findProjects = SqlSchema.findAll({
      Request: Schema.Void,
      Result: ProjectRow,
      execute: () => sql`SELECT * FROM project ORDER BY name`,
    });
    const findProject = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: ProjectRow,
      execute: (id) => sql`SELECT * FROM project WHERE id = ${id} LIMIT 1`,
    });
    const findClient = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: OAuthClientRow,
      execute: (clientId) =>
        sql`SELECT * FROM oauth_client WHERE client_id = ${clientId} LIMIT 1`,
    });
    const findOrganization = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: OrganizationRow,
      execute: (id) => sql`SELECT * FROM organization WHERE id = ${id} LIMIT 1`,
    });
    const findDomains = SqlSchema.findAll({
      Request: Schema.Struct({
        host: Schema.String,
        rootHost: Schema.NullOr(Schema.String),
      }).annotate({ identifier: "ProjectDomainRequest" }),
      Result: DomainRow,
      execute: ({ host, rootHost }) => sql`
        SELECT * FROM domains WHERE hostname = ${host} AND active = true
        ${rootHost ? sql`AND root_hostname = ${rootHost}` : sql``} LIMIT 2
      `,
    });
    const insertProject = SqlSchema.findOne({
      Request: CreateProjectPayload,
      Result: ProjectRow,
      execute: (payload) => sql`INSERT INTO project (id, name, logo, data)
        VALUES (${crypto.randomUUID()}, ${payload.name.trim()}, ${payload.logo ?? null},
          ${Schema.encodeSync(ProjectDataJson)(decodeProjectData(payload.data))}::jsonb) RETURNING *`,
    });
    const updateProject = SqlSchema.findOneOption({
      Request: UpdateProjectRequest,
      Result: ProjectRow,
      execute: ({ id, payload }) => {
        const updates: ProjectSqlUpdate = {
          data: Schema.encodeSync(ProjectDataJson)(
            decodeProjectData(payload.data),
          ),
          updatedAt: new Date(),
        };
        if (payload.name !== undefined) updates.name = payload.name.trim();
        if (payload.logo !== undefined) updates.logo = payload.logo;
        return sql`UPDATE project SET ${sql.update(updates)} WHERE id = ${id} RETURNING *`;
      },
    });
    const removeProject = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: ProjectRow,
      execute: (id) => sql`DELETE FROM project WHERE id = ${id} RETURNING *`,
    });

    const list = Effect.fn("Projects.list")(function* () {
      const rows = yield* findProjects(undefined);
      return rows.map(row);
    });

    const get = Effect.fn("Projects.get")(function* ({ id }: { id: string }) {
      const value = Option.getOrNull(yield* findProject(id));
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
      client?: typeof OAuthClientRow.Type;
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
        const value = Option.getOrNull(yield* findProject(projectId));
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
        const matchingDomains = yield* findDomains({
          host: normalizedHost,
          rootHost: normalizedRootHost,
        });
        const domain =
          matchingDomains.length === 1 ? (matchingDomains[0] ?? null) : null;
        if (domain) {
          const value = domain.projectId
            ? Option.getOrNull(yield* findProject(domain.projectId))
            : null;
          const organization = domain.organizationId
            ? Option.getOrNull(yield* findOrganization(domain.organizationId))
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
        const client = Option.getOrNull(yield* findClient(clientId));

        if (client && !client.disabled) {
          const value = client.projectId
            ? Option.getOrNull(yield* findProject(client.projectId))
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
      return row(yield* insertProject(payload));
    });

    const update = Effect.fn("Projects.update")(function* ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProjectPayload;
    }) {
      const value = Option.getOrNull(yield* updateProject({ id, payload }));

      return value ? row(value) : null;
    });

    const _delete = Effect.fn("Projects.delete")(function* ({
      id,
    }: {
      id: string;
    }) {
      const value = Option.getOrNull(yield* removeProject(id));

      return value ? row(value) : null;
    });

    return { list, get, getPublicConfig, create, update, delete: _delete };
  }),
}) {
  static readonly baseLayer = Layer.effect(this, this.make);
  static readonly layer = this.baseLayer.pipe(Layer.provide(sqlLayer));
  static readonly testLayer = this.baseLayer.pipe(Layer.provide(sqlTestLayer));
}
