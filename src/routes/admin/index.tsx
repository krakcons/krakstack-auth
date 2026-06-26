import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Building2,
  FolderKanban,
  Globe2,
  KeyRound,
  KeySquare,
  Users,
} from "lucide-react";
import { useState } from "react";

import { m } from "@/paraglide/messages";
import { SidebarPageHeader } from "@/components/ui/sidebar-layout";
import { StatsCard } from "@/components/ui/stats-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

type DashboardStats = {
  totalUsers: number;
  totalOrganizations: number;
  totalProjects: number;
  totalDomains: number;
  totalApiKeys: number;
  totalOauthClients: number;
  dailyActiveUsers: number;
  dailyActiveUsersByDay: { date: string; count: number }[];
  signupsByDay: { date: string; count: number }[];
};

const chartRanges = ["7", "14", "30", "90"] as const;
type ChartRange = (typeof chartRanges)[number];

const chartRangeOptions: { value: ChartRange; label: string }[] = [
  { value: "7", label: m.admin_chart_range_7_days() },
  { value: "14", label: m.admin_chart_range_14_days() },
  { value: "30", label: m.admin_chart_range_30_days() },
  { value: "90", label: m.admin_chart_range_90_days() },
];

const isChartRange = (value: string): value is ChartRange =>
  chartRanges.includes(value as ChartRange);

function useDashboardStats(range: ChartRange) {
  return useQuery({
    queryKey: ["admin", "dashboard", range],
    queryFn: async () => {
      const params = new URLSearchParams({ days: range });
      const res = await fetch(`/api/admin/dashboard-stats?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats.");
      return (await res.json()) as DashboardStats;
    },
  });
}

const chartConfig = {
  count: {
    label: m.admin_daily_active_users(),
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const signupsChartConfig = {
  count: {
    label: m.admin_signups(),
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const formatDay = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function DashboardPage() {
  const [chartRange, setChartRange] = useState<ChartRange>("14");
  const { data: stats, isLoading, error } = useDashboardStats(chartRange);

  const formatStat = (value: number | undefined) =>
    isLoading ? "..." : (value ?? 0).toLocaleString();

  return (
    <>
      <SidebarPageHeader
        title={m.admin_dashboard()}
        description={m.admin_dashboard_description()}
      />

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to="/admin/users"
              preload="intent"
              className="group/card-link focus-visible:ring-ring/50 min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
            >
              <StatsCard
                title={m.admin_users_title()}
                value={formatStat(stats?.totalUsers)}
                description={m.admin_registered_users()}
                icon={<Users className="text-muted-foreground" />}
              />
            </Link>
            <Link
              to="/admin/organizations"
              preload="intent"
              className="group/card-link focus-visible:ring-ring/50 min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
            >
              <StatsCard
                title={m.admin_organizations_title()}
                value={formatStat(stats?.totalOrganizations)}
                description={m.admin_registered_organizations()}
                icon={<Building2 className="text-muted-foreground" />}
              />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/admin/projects"
              preload="intent"
              className="group/card-link focus-visible:ring-ring/50 min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
            >
              <StatsCard
                title={m.sidebar_nav_projects()}
                value={formatStat(stats?.totalProjects)}
                description={m.admin_registered_projects()}
                icon={<FolderKanban className="text-muted-foreground" />}
              />
            </Link>
            <Link
              to="/admin/domains"
              preload="intent"
              className="group/card-link focus-visible:ring-ring/50 min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
            >
              <StatsCard
                title={m.sidebar_nav_domains()}
                value={formatStat(stats?.totalDomains)}
                description={m.admin_registered_domains()}
                icon={<Globe2 className="text-muted-foreground" />}
              />
            </Link>
            <Link
              to="/admin/api-keys"
              preload="intent"
              className="group/card-link focus-visible:ring-ring/50 min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
            >
              <StatsCard
                title={m.sidebar_nav_api_keys()}
                value={formatStat(stats?.totalApiKeys)}
                description={m.admin_registered_api_keys()}
                icon={<KeySquare className="text-muted-foreground" />}
              />
            </Link>
            <Link
              to="/admin/oauth/clients"
              preload="intent"
              className="group/card-link focus-visible:ring-ring/50 min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
            >
              <StatsCard
                title={m.admin_oauth_clients()}
                value={formatStat(stats?.totalOauthClients)}
                description={m.admin_registered_clients()}
                icon={<KeyRound className="text-muted-foreground" />}
              />
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{m.admin_trends()}</h2>
            <Select
              items={chartRangeOptions}
              value={chartRange}
              onValueChange={(value) => {
                if (value && isChartRange(value)) setChartRange(value);
              }}
            >
              <SelectTrigger
                className="w-full sm:w-40"
                aria-label={m.admin_chart_range()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartRangeOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{m.admin_dau_chart_title()}</CardTitle>
              <CardDescription>
                {m.admin_dau_chart_description()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="min-h-[260px] w-full"
              >
                <AreaChart
                  accessibilityLayer
                  data={stats?.dailyActiveUsersByDay ?? []}
                  margin={{ left: 0, right: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatDay(String(value))}
                      />
                    }
                  />
                  <Area
                    dataKey="count"
                    type="monotone"
                    fill="var(--color-count)"
                    fillOpacity={0.2}
                    stroke="var(--color-count)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{m.admin_signups_chart_title()}</CardTitle>
              <CardDescription>
                {m.admin_signups_chart_description()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={signupsChartConfig}
                className="min-h-[260px] w-full"
              >
                <AreaChart
                  accessibilityLayer
                  data={stats?.signupsByDay ?? []}
                  margin={{ left: 0, right: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatDay(String(value))}
                      />
                    }
                  />
                  <Area
                    dataKey="count"
                    type="monotone"
                    fill="var(--color-count)"
                    fillOpacity={0.2}
                    stroke="var(--color-count)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
