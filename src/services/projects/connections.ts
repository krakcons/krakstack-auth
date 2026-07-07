import { eq } from "drizzle-orm";

import { project, projectOrganization, projectUser } from "@/db/schema";
import { db } from "@/services/database";

const normalizeProjectId = (projectId: string | null | undefined) => {
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : null;
};

const projectExists = async (projectId: string) => {
  const [value] = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  return Boolean(value);
};

export const connectProjectUser = async ({
  projectId,
  userId,
}: {
  projectId: string | null | undefined;
  userId: string | null | undefined;
}) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedUserId = userId?.trim();
  if (!normalizedProjectId || !normalizedUserId) return;
  if (!(await projectExists(normalizedProjectId))) return;

  await db
    .insert(projectUser)
    .values({
      id: crypto.randomUUID(),
      projectId: normalizedProjectId,
      userId: normalizedUserId,
    })
    .onConflictDoNothing();
};

export const connectProjectOrganization = async ({
  projectId,
  organizationId,
}: {
  projectId: string | null | undefined;
  organizationId: string | null | undefined;
}) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedOrganizationId = organizationId?.trim();
  if (!normalizedProjectId || !normalizedOrganizationId) return;
  if (!(await projectExists(normalizedProjectId))) return;

  await db
    .insert(projectOrganization)
    .values({
      id: crypto.randomUUID(),
      projectId: normalizedProjectId,
      organizationId: normalizedOrganizationId,
    })
    .onConflictDoNothing();
};

export const connectProjectSession = async ({
  projectId,
  userId,
  activeOrganizationId,
}: {
  projectId: string | null | undefined;
  userId: string | null | undefined;
  activeOrganizationId: string | null | undefined;
}) => {
  await connectProjectUser({ projectId, userId });
  await connectProjectOrganization({
    projectId,
    organizationId: activeOrganizationId,
  });
};
