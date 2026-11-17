import { AsyncResult, Atom } from "effect/reactivity";
import type { OrganizationSsoSettings } from "../auth/schema.js";
import { authClientApi } from "./auth-client-api.js";

export const organizationSsoAtoms = Atom.family((baseUrl?: string) => {
  const client = authClientApi(baseUrl);
  return Atom.family((organizationId: string) => {
    const reactivityKeys = [
      `organization-sso:${baseUrl ?? ""}:${organizationId}`,
    ];
    const settings = Atom.optimistic(
      client.query("auth", "getOrganizationSso", {
        query: { organizationId },
        reactivityKeys,
        timeToLive: "1 minute",
      }),
    );
    const saveMutation = client.mutation("auth", "saveOrganizationSso");
    const verifyMutation = client.mutation("auth", "verifyOrganizationSso");
    const enableMutation = client.mutation("auth", "setOrganizationSsoEnabled");
    const deleteMutation = client.mutation("auth", "deleteOrganizationSso");

    // Discovery, DNS proof and account unlinking cannot be predicted safely.
    const save = Atom.fn(
      (
        payload: Omit<typeof OrganizationSsoSettings.Type, "organizationId">,
        get,
      ) =>
        get.setResult(saveMutation, {
          payload: { ...payload, organizationId },
          reactivityKeys,
        }),
    );
    const verify = Atom.fn((_: void, get) =>
      get.setResult(verifyMutation, {
        payload: { organizationId },
        reactivityKeys,
      }),
    );
    const remove = Atom.fn((_: void, get) =>
      get.setResult(deleteMutation, {
        payload: { organizationId },
        reactivityKeys,
      }),
    );
    const enable = Atom.optimisticFn(settings, {
      reducer: (state, enabled: boolean) =>
        AsyncResult.map(state, (connection) =>
          connection ? { ...connection, enabled } : null,
        ),
      fn: Atom.fn((enabled: boolean, get) =>
        get.setResult(enableMutation, {
          payload: { organizationId, enabled },
          reactivityKeys,
        }),
      ),
    });
    return { settings, save, verify, remove, enable };
  });
});
