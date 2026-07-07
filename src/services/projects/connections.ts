import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { project, projectOrganization, projectUser } from "@/db/schema";
import { DB } from "@/services/database";

const normalizeProjectId = (projectId: string | null | undefined) => {
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : null;
};

const projectExists = (projectId: string) =>
  Effect.gen(function* () {
    const db = yield* DB;
    const [value] = yield* db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

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

    const db = yield* DB;
    yield* db
      .insert(projectUser)
      .values({
        id: crypto.randomUUID(),
        projectId: normalizedProjectId,
        userId: normalizedUserId,
      })
      .onConflictDoNothing();
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

    const db = yield* DB;
    yield* db
      .insert(projectOrganization)
      .values({
        id: crypto.randomUUID(),
        projectId: normalizedProjectId,
        organizationId: normalizedOrganizationId,
      })
      .onConflictDoNothing();
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
