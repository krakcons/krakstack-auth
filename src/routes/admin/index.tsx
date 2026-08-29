import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  FolderKanban,
  Globe2,
  KeyRound,
  KeySquare,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Schema } from "effect";

import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { StatsCard } from "@krak-stack/registry/stats-card";
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

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

const DailyCount = Schema.Struct({ date: Schema.String, count: Schema.Number });
type DailyCount = typeof DailyCount.Type;
const ProjectConnection = Schema.Struct({
  projectId: Schema.String,
  projectName: Schema.String,
  users: Schema.Number,
  organizations: Schema.Number,
});
type ProjectConnection = typeof ProjectConnection.Type;
const DashboardStats = Schema.Struct({
  totalUsers: Schema.Number,
  totalOrganizations: Schema.Number,
  totalProjects: Schema.Number,
  totalDomains: Schema.Number,
  totalApiKeys: Schema.Number,
  totalOauthClients: Schema.Number,
  dailyActiveUsers: Schema.Number,
  dailyActiveUsersByDay: Schema.Array(DailyCount),
  signupsByDay: Schema.Array(DailyCount),
  projectConnections: Schema.Array(ProjectConnection),
}).annotate({ identifier: "DashboardStats" });

const chartRanges = ["7", "14", "30", "90"] as const;
type ChartRange = (typeof chartRanges)[number];

const chartRangeOptions: { value: ChartRange; label: string }[] = [
  { value: "7", label: m.admin_chart_range_7_days() },
  { value: "14", label: m.admin_chart_range_14_days() },
  { value: "30", label: m.admin_chart_range_30_days() },
  { value: "90", label: m.admin_chart_range_90_days() },
];

const isChartRange = (value: string): value is ChartRange =>
  chartRanges.some((range) => range === value);

function useDashboardStats(range: ChartRange) {
  return useQuery({
    queryKey: ["admin", "dashboard", range],
    queryFn: async () => {
      const params = new URLSearchParams({ days: range });
      const res = await fetch(`/api/auth/admin/dashboard-stats?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats.");
      return Schema.decodeUnknownPromise(DashboardStats)(await res.json());
    },
  });
}

const formatDay = (value: string, locale: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const chartTickIndices = (length: number) => {
  if (length <= 1) return length === 1 ? [0] : [];
  const tickCount = Math.min(5, length);
  return Array.from(
    new Set(
      Array.from({ length: tickCount }, (_, index) =>
        Math.round((index * (length - 1)) / (tickCount - 1)),
      ),
    ),
  );
};

function TrendChart({
  data,
  title,
  valueLabel,
}: {
  data: ReadonlyArray<DailyCount>;
  title: string;
  valueLabel: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
        {m.admin_chart_no_data()}
      </p>
    );
  }

  const locale = getLocale();
  const width = 720;
  const height = 260;
  const padding = { top: 16, right: 16, bottom: 34, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const dataMax = Math.max(1, ...data.map(({ count }) => count));
  const tickStep = Math.max(1, Math.ceil(dataMax / 4));
  const domainMax = tickStep * 4;
  const baseline = padding.top + innerHeight;
  const points = data.map(({ count }, index) => ({
    x:
      padding.left +
      (data.length === 1
        ? innerWidth / 2
        : (index / (data.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (count / domainMax) * innerHeight,
  }));
  const linePath = points
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? padding.left} ${baseline} L ${points[0]?.x ?? padding.left} ${baseline} Z`;

  return (
    <figure className="grid gap-3">
      <svg
        aria-label={title}
        className="h-auto min-h-64 w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 1, 2, 3, 4].map((index) => {
          const value = tickStep * index;
          const y = baseline - (value / domainMax) * innerHeight;
          return (
            <g key={value}>
              <line
                className="stroke-border/60"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text
                className="fill-muted-foreground text-[11px]"
                dominantBaseline="middle"
                textAnchor="end"
                x={padding.left - 9}
                y={y}
              >
                {value.toLocaleString(locale)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="var(--chart-1)" fillOpacity="0.2" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--chart-1)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {points.map(({ x, y }, index) => (
          <circle
            className="fill-background stroke-[var(--chart-1)]"
            cx={x}
            cy={y}
            key={data[index]?.date}
            r="3"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${formatDay(data[index]?.date ?? "", locale)}: ${data[index]?.count.toLocaleString(locale)}`}</title>
          </circle>
        ))}
        {chartTickIndices(data.length).map((index) => {
          const point = points[index];
          const datum = data[index];
          if (!point || !datum) return null;
          return (
            <text
              className="fill-muted-foreground text-[11px]"
              key={datum.date}
              textAnchor={
                index === 0
                  ? "start"
                  : index === data.length - 1
                    ? "end"
                    : "middle"
              }
              x={point.x}
              y={height - 9}
            >
              {formatDay(datum.date, locale)}
            </text>
          );
        })}
      </svg>
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer">
          {m.admin_chart_view_data()}
        </summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-md border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-muted/60 sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">
                  {m.admin_chart_date()}
                </th>
                <th className="px-3 py-2 text-right font-medium" scope="col">
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map(({ date, count }) => (
                <tr className="border-t" key={date}>
                  <td className="px-3 py-2">{formatDay(date, locale)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {count.toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function ProjectConnectionBars({
  data,
}: {
  data: ReadonlyArray<ProjectConnection>;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
        {m.admin_chart_no_data()}
      </p>
    );
  }

  const locale = getLocale();
  const maximum = Math.max(
    1,
    ...data.flatMap(({ users, organizations }) => [users, organizations]),
  );

  return (
    <ul className="grid gap-5">
      {data.map((project) => (
        <li className="grid gap-2" key={project.projectId}>
          <strong className="truncate text-sm font-medium">
            {project.projectName}
          </strong>
          {[
            {
              label: m.admin_project_connections_users(),
              value: project.users,
              color: "var(--chart-1)",
            },
            {
              label: m.admin_project_connections_organizations(),
              value: project.organizations,
              color: "oklch(0.78 0.09 72)",
            },
          ].map(({ label, value, color }) => (
            <div
              className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm"
              key={label}
            >
              <span className="text-muted-foreground truncate">{label}</span>
              <div
                aria-label={`${project.projectName}, ${label}: ${value.toLocaleString(locale)}`}
                className="bg-muted h-2.5 overflow-hidden rounded-full"
                role="img"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: color,
                    width: `${(value / maximum) * 100}%`,
                  }}
                />
              </div>
              <span className="min-w-8 text-right font-mono font-medium tabular-nums">
                {value.toLocaleString(locale)}
              </span>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}

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
              <TrendChart
                data={stats?.dailyActiveUsersByDay ?? []}
                title={m.admin_dau_chart_title()}
                valueLabel={m.admin_daily_active_users()}
              />
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
              <TrendChart
                data={stats?.signupsByDay ?? []}
                title={m.admin_signups_chart_title()}
                valueLabel={m.admin_signups()}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{m.admin_project_connections_chart_title()}</CardTitle>
              <CardDescription>
                {m.admin_project_connections_chart_description()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectConnectionBars data={stats?.projectConnections ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
