import { SecureRandom } from "effect/crypto";
import { authenticationActivitySummary } from "@/services/authentication-activity";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import {
  DomainRow,
  OAuthClientRow,
  OrganizationRow,
  ProjectRow,
} from "@/db/schema";
import { normalizeAuthHost } from "@/lib/domain-utils";
import { sqlLayer, sqlTestLayer } from "@/services/database";
import { Events } from "@krak-stack/registry/events";
import { testEventsLayer } from "@/services/audit/test-layer";
import { sanitizeThemeCss } from "@/services/oauth/theme";
import { organizationBranding } from "@/services/organizations/branding";
import { AuthEmailSettings } from "@/services/auth-emails/schema";

import {
  ProjectData,
  ProjectStatsTotals,
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
  email: Schema.optional(Schema.Unknown),
  branding: ProjectData.fields.branding,
  authOptions: ProjectData.fields.authOptions,
});

export const decodeProjectData = (value: typeof Schema.Unknown.Type) => {
  const stored = Schema.decodeSync(StoredProjectData)(value ?? emptyData);

  let data: ProjectData = {};
  if (stored.branding) data = { ...data, branding: stored.branding };
  if (stored.authOptions) data = { ...data, authOptions: stored.authOptions };
  const email = Schema.decodeUnknownOption(AuthEmailSettings)(stored.email);
  if (Option.isSome(email)) data = { ...data, email: email.value };
  return Schema.decodeSync(ProjectData)(data);
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
    const random = yield* SecureRandom.SecureRandom.pipe(
      Effect.provide(SecureRandom.layerWebCrypto),
    );
    const sql = yield* SqlClient.SqlClient;
    const events = yield* Events;
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

    const list = Effect.fn("Projects.list")(function* () {
      const rows = yield* findProjects(undefined);
      return rows.map(row);
    });

    const get = Effect.fn("Projects.get")(function* ({ id }: { id: string }) {
      const value = Option.getOrNull(yield* findProject(id));
      return value ? row(value) : null;
    });

    const stats = Effect.fn("Projects.stats")(function* ({
      id,
      days = 14,
    }: {
      id: string;
      days?: number;
    }) {
      const totals = yield* SqlSchema.findOne({
        Request: Schema.String,
        Result: ProjectStatsTotals,
        execute: (projectId) => sql`SELECT
          (SELECT count(*)::int FROM project_user WHERE project_id = ${projectId}) AS users,
          (SELECT count(*)::int FROM project_organization WHERE project_id = ${projectId}) AS organizations`,
      })(id);
      return {
        ...totals,
        ...(yield* authenticationActivitySummary({ projectId: id, days })),
      };
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
      const id = yield* random.uuidV7();
      const project = yield* SqlSchema.findOne({
        Request: CreateProjectPayload,
        Result: ProjectRow,
        execute: (payload) => sql`INSERT INTO project (id, name, logo, data)
          VALUES (${id}, ${payload.name.trim()}, ${payload.logo ?? null},
            ${Schema.encodeSync(ProjectDataJson)(decodeProjectData(payload.data))}::jsonb) RETURNING *`,
      })(payload);
      yield* events.track({
        name: "project.created",
        category: "audit",
        target: { id: project.id, name: project.id, type: "project" },
      });
      return row(project);
    }, sql.withTransaction);

    const update = Effect.fn("Projects.update")(function* ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProjectPayload;
    }) {
      const value = Option.getOrNull(
        yield* SqlSchema.findOneOption({
          Request: UpdateProjectRequest,
          Result: ProjectRow,
          execute: ({ id, payload }) => {
            const { email: _email, ...generalData } = decodeProjectData(
              payload.data,
            );
            const updates: Omit<ProjectSqlUpdate, "data"> = {
              updatedAt: new Date(),
            };
            if (payload.name !== undefined) updates.name = payload.name.trim();
            if (payload.logo !== undefined) updates.logo = payload.logo;
            // General settings must not overwrite email settings from a stale form.
            return sql`UPDATE project SET ${sql.update(updates)}, data =
              ${Schema.encodeSync(ProjectDataJson)(generalData)}::jsonb ||
              CASE WHEN data ? 'email' THEN jsonb_build_object('email', data->'email') ELSE '{}'::jsonb END
              WHERE id = ${id} RETURNING *`;
          },
        })({ id, payload }),
      );
      if (value)
        yield* events.track({
          name: "project.updated",
          category: "audit",
          target: { id: value.id, name: value.id, type: "project" },
        });
      return value ? row(value) : null;
    }, sql.withTransaction);

    const updateEmail = Effect.fn("Projects.updateEmail")(function* ({
      id,
      settings,
    }: {
      id: string;
      settings: AuthEmailSettings;
    }) {
      const rows = yield* SqlSchema.findAll({
        Request: Schema.Struct({
          id: Schema.String,
          settings: AuthEmailSettings,
        }).annotate({ identifier: "UpdateProjectEmailRequest" }),
        Result: ProjectRow,
        execute: ({ id, settings }) => sql`UPDATE project
          SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{email}', ${Schema.encodeSync(Schema.fromJsonString(AuthEmailSettings))(settings)}::jsonb), updated_at = now()
          WHERE id = ${id} RETURNING *`,
      })({ id, settings });
      const value = rows[0];
      if (!value) return null;
      yield* events.track({
        name: "project.email.updated",
        category: "audit",
        target: { id, name: id, type: "project" },
      });
      return row(value);
    }, sql.withTransaction);

    const _delete = Effect.fn("Projects.delete")(function* ({
      id,
    }: {
      id: string;
    }) {
      yield* sql`UPDATE oauth_resource SET disabled = true, policy_version = policy_version + 1, updated_at = now()
        WHERE identifier IN (SELECT url FROM project_mcp WHERE project_id = ${id})`;
      yield* sql`DELETE FROM oauth_client_resource WHERE resource_id IN (SELECT url FROM project_mcp WHERE project_id = ${id})`;
      const value = Option.getOrNull(
        yield* SqlSchema.findOneOption({
          Request: Schema.String,
          Result: ProjectRow,
          execute: (id) =>
            sql`DELETE FROM project WHERE id = ${id} RETURNING *`,
        })(id),
      );
      if (value)
        yield* events.track({
          name: "project.deleted",
          category: "audit",
          target: { id: value.id, name: value.id, type: "project" },
        });
      return value ? row(value) : null;
    }, sql.withTransaction);

    return {
      list,
      get,
      stats,
      getPublicConfig,
      create,
      update,
      updateEmail,
      delete: _delete,
    };
  }),
}) {
  static readonly baseLayer = Layer.effect(this, this.make);
  static readonly layer = this.baseLayer.pipe(Layer.provide(sqlLayer));
  static readonly testLayer = this.baseLayer.pipe(
    Layer.provideMerge(testEventsLayer),
    Layer.provide(sqlTestLayer),
  );
}
