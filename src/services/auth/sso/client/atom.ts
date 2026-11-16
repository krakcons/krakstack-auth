import { AsyncResult, Atom } from "effect/reactivity";
import { AuthApiClient } from "@/services/auth/client";
import type { OrganizationSsoSettings } from "@krak-stack/auth/auth";

const keys = (organizationId: string) => [`organization-sso:${organizationId}`];
export const organizationSsoAtom = Atom.family((organizationId: string) =>
  Atom.optimistic(
    AuthApiClient.query("auth", "getOrganizationSso", {
      query: { organizationId },
      reactivityKeys: keys(organizationId),
      timeToLive: "1 minute",
    }),
  ),
);
const saveMutation = AuthApiClient.mutation("auth", "saveOrganizationSso");
const verifyMutation = AuthApiClient.mutation("auth", "verifyOrganizationSso");
const enableMutation = AuthApiClient.mutation(
  "auth",
  "setOrganizationSsoEnabled",
);
const deleteMutation = AuthApiClient.mutation("auth", "deleteOrganizationSso");

// Discovery, DNS proof and account unlinking cannot be predicted safely.
export const saveOrganizationSsoAtom = Atom.family((organizationId: string) =>
  Atom.fn(
    (
      payload: Omit<typeof OrganizationSsoSettings.Type, "organizationId">,
      get,
    ) =>
      get.setResult(saveMutation, {
        payload: { ...payload, organizationId },
        reactivityKeys: keys(organizationId),
      }),
  ),
);
export const verifyOrganizationSsoAtom = Atom.family((organizationId: string) =>
  Atom.fn((_: void, get) =>
    get.setResult(verifyMutation, {
      payload: { organizationId },
      reactivityKeys: keys(organizationId),
    }),
  ),
);
export const deleteOrganizationSsoAtom = Atom.family((organizationId: string) =>
  Atom.fn((_: void, get) =>
    get.setResult(deleteMutation, {
      payload: { organizationId },
      reactivityKeys: keys(organizationId),
    }),
  ),
);
export const enableOrganizationSsoAtom = Atom.family((organizationId: string) =>
  Atom.optimisticFn(organizationSsoAtom(organizationId), {
    reducer: (state, enabled: boolean) =>
      AsyncResult.map(state, (connection) =>
        connection ? { ...connection, enabled } : null,
      ),
    fn: Atom.fn((enabled: boolean, get) =>
      get.setResult(enableMutation, {
        payload: { organizationId, enabled },
        reactivityKeys: keys(organizationId),
      }),
    ),
  }),
);
