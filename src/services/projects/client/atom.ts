import { Atom, AsyncResult } from "effect/reactivity";
import { AdminApiClient } from "@/lib/admin-api-client";
import type { UpdateProjectPayload } from "../schema";
import type { ChartRange } from "@/services/admin/client/atom";
import type {
  AuthEmailSettings,
  AuthEmailPreviewPayload,
} from "@/services/auth-emails/schema";

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
      payload: UpdateProjectPayload;
    },
  ) =>
    AsyncResult.map(state, (projects) =>
      projects.map((project) =>
        project.id === input.params.id
          ? {
              ...project,
              ...input.payload,
              data: { ...input.payload.data, email: project.data.email },
            }
          : project,
      ),
    ),
  fn: Atom.fn(
    (
      input: {
        params: { id: string };
        payload: UpdateProjectPayload;
      },
      get,
    ) =>
      get.setResult(updateProjectMutation, {
        ...input,
        reactivityKeys: ["projects"],
      }),
  ),
});

const updateEmailMutation = AdminApiClient.mutation(
  "projects",
  "updateProjectEmail",
);
export const updateProjectEmailAtom = Atom.optimisticFn(projectsAtom, {
  reducer: (
    state,
    input: { params: { id: string }; payload: AuthEmailSettings },
  ) =>
    AsyncResult.map(state, (projects) =>
      projects.map((project) =>
        project.id === input.params.id
          ? { ...project, data: { ...project.data, email: input.payload } }
          : project,
      ),
    ),
  fn: Atom.fn(
    (input: { params: { id: string }; payload: AuthEmailSettings }, get) =>
      get.setResult(updateEmailMutation, {
        ...input,
        reactivityKeys: ["projects"],
      }),
  ),
});

// Preview results are scoped to the exact draft; older requests cannot replace a newer preview.
export const projectEmailPreviewAtom = Atom.family(
  (input: { params: { id: string }; payload: AuthEmailPreviewPayload }) =>
    AdminApiClient.query("projects", "previewProjectEmail", {
      ...input,
      timeToLive: "30 seconds",
      reactivityKeys: ["projects"],
    }),
);
export const testProjectEmailAtom = AdminApiClient.mutation(
  "projects",
  "testProjectEmail",
);

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
