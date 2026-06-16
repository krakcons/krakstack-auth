import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { useAtomSuspense } from "@effect/atom-react";

import { AdminApiClient } from "@/lib/admin-api-client";

import type { ProjectPublicConfig } from "@/services/projects/schema";

export const getOAuthClientIdFromSearch = (searchString: string) => {
  if (!searchString) return null;
  const search = new URLSearchParams(searchString);
  return search.get("client_id");
};

export const getProjectIdFromSearch = (searchString: string) => {
  if (!searchString) return null;
  const search = new URLSearchParams(searchString);
  return search.get("projectId");
};

export const getBrowserAuthHost = () =>
  typeof window === "undefined" ? null : window.location.host;

const projectPublicConfigReactivityKeys = ({
  projectId,
  clientId,
  host,
}: {
  projectId: string | null;
  clientId: string | null;
  host: string | null;
}) => [
  "project-public-config",
  ...(projectId ? [`project:${projectId}`] : []),
  ...(clientId ? [`client:${clientId}`] : []),
  ...(host ? [`host:${host}`] : []),
];

export const projectPublicConfigAtom = Atom.family(
  ({
    projectId,
    clientId,
    host,
  }: {
    projectId: string | null;
    clientId: string | null;
    host: string | null;
  }) =>
    projectId || clientId || host
      ? AdminApiClient.query("projects", "getProjectPublicConfig", {
          query: {
            ...(projectId ? { projectId } : {}),
            ...(clientId ? { clientId } : {}),
            ...(host ? { host } : {}),
          },
          timeToLive: "5 minutes",
          reactivityKeys: projectPublicConfigReactivityKeys({
            projectId,
            clientId,
            host,
          }),
          serializationKey: `project-public-config:${projectId ?? ""}:${clientId ?? ""}:${host ?? ""}`,
        })
      : Atom.make(AsyncResult.success<ProjectPublicConfig | null, never>(null)),
);

export const useProjectPublicConfigSuspense = (
  projectId: string | null,
  clientId: string | null,
  host = getBrowserAuthHost(),
) =>
  useAtomSuspense(projectPublicConfigAtom({ projectId, clientId, host }), {
    suspendOnWaiting: true,
  }).value;
