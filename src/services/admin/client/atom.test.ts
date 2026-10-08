import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { AtomRegistry, AsyncResult } from "effect/reactivity";
import { vi } from "vitest";

import { dashboardStatsAtom, serverDashboardStatsAtom } from "./atom";

const stats = {
  totalUsers: 5,
  totalOrganizations: 2,
  totalProjects: 1,
  totalDomains: 1,
  totalApiKeys: 0,
  totalOauthClients: 0,
  dailyActiveUsers: 3,
  dailyActiveUsersByDay: [{ date: "2026-10-08", count: 3 }],
  signupsByDay: [{ date: "2026-10-08", count: 1 }],
  projectConnections: [],
};

let response = stats;
const requests: string[] = [];
const testFetch = async (input: RequestInfo | URL) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  requests.push(`${url.pathname}${url.search}`);
  return Response.json(response);
};

describe("dashboard stats atoms", () => {
  it.effect(
    "caches each chart range independently and sends the typed query",
    () =>
      Effect.gen(function* () {
        requests.length = 0;
        response = stats;
        vi.stubGlobal("fetch", testFetch);
        const registry = AtomRegistry.make();
        const week = dashboardStatsAtom("7");
        const month = dashboardStatsAtom("30");
        try {
          expect(dashboardStatsAtom("7")).toBe(week);
          expect(month).not.toBe(week);
          expect(yield* AtomRegistry.getResult(registry, week)).toEqual(stats);
          expect(yield* AtomRegistry.getResult(registry, month)).toEqual(stats);
          expect(yield* AtomRegistry.getResult(registry, week)).toEqual(stats);
          expect(requests).toEqual([
            "/api/auth/admin/dashboard-stats?days=7",
            "/api/auth/admin/dashboard-stats?days=30",
          ]);
        } finally {
          registry.dispose();
          vi.unstubAllGlobals();
        }
      }),
  );

  it.effect(
    "keeps successful stats visible while the same range refreshes",
    () =>
      Effect.gen(function* () {
        response = stats;
        requests.length = 0;
        vi.stubGlobal("fetch", testFetch);
        const atom = dashboardStatsAtom("14");
        const serverAtom = serverDashboardStatsAtom("14");
        const registry = AtomRegistry.make();
        const unmount = registry.mount(atom);
        try {
          expect(yield* AtomRegistry.getResult(registry, atom)).toEqual(stats);
          yield* Effect.yieldNow;
          response = { ...stats, totalUsers: 6 };
          registry.refresh(serverAtom);
          expect(registry.get(atom)).toMatchObject({
            _tag: "Success",
            value: stats,
          });
          const totalUsers = yield* Effect.callback<number>((resume) => {
            const unsubscribe = registry.subscribe(
              atom,
              (result) => {
                if (
                  AsyncResult.isSuccess(result) &&
                  result.value.totalUsers === 6
                ) {
                  resume(Effect.succeed(result.value.totalUsers));
                }
              },
              { immediate: true },
            );
            return Effect.sync(unsubscribe);
          });
          expect(totalUsers).toBe(6);
        } finally {
          unmount();
          registry.dispose();
          vi.unstubAllGlobals();
        }
      }),
  );
});
