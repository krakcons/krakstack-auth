import { Atom, AsyncResult } from "effect/reactivity";
import { AdminApiClient } from "@/lib/admin-api-client";
import type { UpdateProjectPayload } from "../schema";
import type { ChartRange } from "@/services/admin/client/atom";

export const projectsAtom = Atom.optimistic(
  AdminApiClient.query("projects", "listProjects", {
    timeToLive: "1 minute",
    reactivityKeys: ["projects"],
  }),
);

const updateProjectMutation = AdminApiClient.mutation(
  "projects",
  "updateProject",
);

export const updateProjectAtom = Atom.optimisticFn(projectsAtom, {
  reducer: (
    state,
    input: {
      params: { id: string };
      payload: typeof UpdateProjectPayload.Type;
    },
  ) =>
    AsyncResult.map(state, (projects) =>
      projects.map((project) =>
        project.id === input.params.id
          ? { ...project, ...input.payload }
          : project,
      ),
    ),
  fn: Atom.fn(
    (
      input: {
        params: { id: string };
        payload: typeof UpdateProjectPayload.Type;
      },
      get,
    ) =>
      get.setResult(updateProjectMutation, {
        ...input,
        reactivityKeys: ["projects"],
      }),
  ),
});

export const projectStatsAtom = Atom.family((id: string) =>
  Atom.family((days: ChartRange) =>
    Atom.optimistic(
      AdminApiClient.query("projects", "projectStats", {
        params: { id },
        query: { days },
        timeToLive: "1 minute",
        reactivityKeys: ["projects"],
      }),
    ),
  ),
);
