import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { Activity, Building2, Users } from "lucide-react";
import { StatsCard } from "@krak-stack/registry/stats-card";
import { useState } from "react";
import { Schema } from "effect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendChart } from "@/services/admin/client/trend-chart";
import type { ChartRange } from "@/services/admin/client/atom";
import { m } from "@/paraglide/messages";
import { projectStatsAtom } from "@/services/projects/client/atom";

export const Route = createFileRoute("/admin/projects/$projectId/")({
  component: ProjectDashboard,
});

function ProjectDashboard() {
  const { projectId } = Route.useParams();
  const [range, setRange] = useState<ChartRange>("14");
  const result = useAtomValue(projectStatsAtom(projectId)(range));
  const ranges = [
    { value: "7", label: m.admin_chart_range_7_days() },
    { value: "14", label: m.admin_chart_range_14_days() },
    { value: "30", label: m.admin_chart_range_30_days() },
    { value: "90", label: m.admin_chart_range_90_days() },
  ];
  const stats = AsyncResult.isSuccess(result) ? result.value : undefined;
  const format = (value: number | undefined) =>
    value === undefined ? "…" : value.toLocaleString();
  if (AsyncResult.isFailure(result))
    return (
      <p role="alert" className="text-destructive text-sm">
        {m.admin_dashboard_load_error()}
      </p>
    );
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title={m.admin_users_title()}
          value={format(stats?.users)}
          description={m.project_connected_users()}
          icon={<Users />}
        />
        <StatsCard
          title={m.admin_organizations_title()}
          value={format(stats?.organizations)}
          description={m.project_connected_organizations()}
          icon={<Building2 />}
        />
        <StatsCard
          title={m.admin_daily_active_users()}
          value={format(stats?.dailyActiveUsers)}
          description={m.project_dau_description()}
          icon={<Activity />}
        />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle>{m.admin_dau_chart_title()}</CardTitle>
              <CardDescription>
                {m.project_dau_chart_description()}
              </CardDescription>
            </div>
            <Select
              items={ranges}
              value={range}
              onValueChange={(value) => {
                const decoded = Schema.decodeUnknownOption(
                  Schema.Literals(["7", "14", "30", "90"]),
                )(value);
                if (decoded._tag === "Some") setRange(decoded.value);
              }}
            >
              <SelectTrigger
                className="w-40"
                aria-label={m.admin_chart_range()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ranges.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={stats?.dailyActiveUsersByDay ?? []}
            title={m.admin_dau_chart_title()}
            valueLabel={m.admin_daily_active_users()}
          />
        </CardContent>
      </Card>
    </>
  );
}
