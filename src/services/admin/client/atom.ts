import type { DashboardStatsQuery } from "@krak-stack/auth/admin";
import { Atom } from "effect/reactivity";

import { AdminApiClient } from "@/lib/admin-api-client";

export type ChartRange = NonNullable<typeof DashboardStatsQuery.Type.days>;

export const serverDashboardStatsAtom = Atom.family((days: ChartRange) =>
  AdminApiClient.query("admin", "dashboardStats", {
    query: { days },
    timeToLive: "1 minute",
  }),
);

export const dashboardStatsAtom = Atom.family((days: ChartRange) =>
  Atom.optimistic(serverDashboardStatsAtom(days)),
);
