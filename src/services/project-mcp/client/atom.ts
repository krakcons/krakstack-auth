import { AsyncResult, Atom } from "effect/reactivity";
import { AdminApiClient } from "@/lib/admin-api-client";
import type { ProjectMcpSettings } from "../schema";

export const projectMcpAtom = Atom.family((projectId: string) =>
  Atom.optimistic(
    AdminApiClient.query("projectMcp", "getProjectMcp", {
      params: { projectId },
      timeToLive: "1 minute",
      reactivityKeys: [`project-mcp:${projectId}`],
    }),
  ),
);

const configureMutation = AdminApiClient.mutation(
  "projectMcp",
  "configureProjectMcp",
);

export const configureProjectMcpAtom = Atom.family((projectId: string) =>
  Atom.optimisticFn(projectMcpAtom(projectId), {
    reducer: (state, settings: ProjectMcpSettings) =>
      AsyncResult.map(state, () => ({
        projectId,
        ...settings,
        url: new URL(settings.url).href,
      })),
    fn: Atom.fn((payload: ProjectMcpSettings, get) =>
      get.setResult(configureMutation, {
        params: { projectId },
        payload,
        reactivityKeys: [`project-mcp:${projectId}`],
      }),
    ),
  }),
);
