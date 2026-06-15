import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { useAtomSuspense } from "@effect/atom-react";

import { AdminApiClient } from "@/lib/admin-api-client";

import type { OAuthClientPublicConfig } from "@/services/oauth/schema";

export const getOAuthClientIdFromSearch = (searchString: string) => {
  if (!searchString) return null;
  const search = new URLSearchParams(searchString);
  return search.get("client_id");
};

export const oauthClientConfigAtom = Atom.family((clientId: string | null) =>
  clientId
    ? AdminApiClient.query("oauthClients", "getOAuthClientConfig", {
        params: { clientId },
        timeToLive: "5 minutes",
        reactivityKeys: ["oauth-client-config", clientId],
        serializationKey: `oauth-client-config:${clientId}`,
      })
    : Atom.make(
        AsyncResult.success<OAuthClientPublicConfig | null, never>(null),
      ),
);

export const useOAuthClientConfigSuspense = (clientId: string | null) =>
  useAtomSuspense(oauthClientConfigAtom(clientId), {
    suspendOnWaiting: true,
  }).value;
