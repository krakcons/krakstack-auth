import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { IdRow } from "@/db/schema";

const normalizeProjectId = (projectId: string | null | undefined) => {
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : null;
};

const projectExists = (projectId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [value] = yield* SqlSchema.findAll({
      Request: Schema.String,
      Result: IdRow,
      execute: (id) => sql`SELECT id FROM project WHERE id = ${id} LIMIT 1`,
    })(projectId);

    return Boolean(value);
  });

export const connectProjectUser = ({
  projectId,
  userId,
}: {
  projectId: string | null | undefined;
  userId: string | null | undefined;
}) =>
  Effect.gen(function* () {
    const normalizedProjectId = normalizeProjectId(projectId);
    const normalizedUserId = userId?.trim();
    if (!normalizedProjectId || !normalizedUserId) return;
    if (!(yield* projectExists(normalizedProjectId))) return;

    const sql = yield* SqlClient.SqlClient;
    yield* SqlSchema.void({
      Request: Schema.Struct({
        projectId: Schema.String,
        userId: Schema.String,
      }).annotate({ identifier: "ProjectUserConnection" }),
      execute: ({
        projectId,
        userId,
      }) => sql`INSERT INTO project_user (id, project_id, user_id)
        VALUES (${crypto.randomUUID()}, ${projectId}, ${userId}) ON CONFLICT DO NOTHING`,
    })({ projectId: normalizedProjectId, userId: normalizedUserId });
  });

export const connectProjectOrganization = ({
  projectId,
  organizationId,
}: {
  projectId: string | null | undefined;
  organizationId: string | null | undefined;
}) =>
  Effect.gen(function* () {
    const normalizedProjectId = normalizeProjectId(projectId);
    const normalizedOrganizationId = organizationId?.trim();
    if (!normalizedProjectId || !normalizedOrganizationId) return;
    if (!(yield* projectExists(normalizedProjectId))) return;

    const sql = yield* SqlClient.SqlClient;
    yield* SqlSchema.void({
      Request: Schema.Struct({
        projectId: Schema.String,
        organizationId: Schema.String,
      }).annotate({ identifier: "ProjectOrganizationConnection" }),
      execute: ({
        projectId,
        organizationId,
      }) => sql`INSERT INTO project_organization (id, project_id, organization_id)
        VALUES (${crypto.randomUUID()}, ${projectId}, ${organizationId}) ON CONFLICT DO NOTHING`,
    })({
      projectId: normalizedProjectId,
      organizationId: normalizedOrganizationId,
    });
  });

export const connectProjectSession = ({
  projectId,
  userId,
  activeOrganizationId,
}: {
  projectId: string | null | undefined;
  userId: string | null | undefined;
  activeOrganizationId: string | null | undefined;
}) =>
  Effect.gen(function* () {
    yield* connectProjectUser({ projectId, userId });
    yield* connectProjectOrganization({
      projectId,
      organizationId: activeOrganizationId,
    });
  });
