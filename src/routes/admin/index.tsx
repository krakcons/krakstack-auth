import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  areaY,
  barX,
  colorLegend,
  defineChart,
  group,
  lineY,
} from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  Building2,
  FolderKanban,
  Globe2,
  KeyRound,
  KeySquare,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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

function TrendChart({
  data,
  title,
  valueLabel,
}: {
  data: ReadonlyArray<DailyCount>;
  title: string;
  valueLabel: string;
}) {
  const locale = getLocale();
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(data, {
              x: "date",
              y1: 0,
              y2: "count",
              fill: "var(--chart-1)",
              fillOpacity: 0.18,
            }),
          ),
          lineY(data, {
            x: "date",
            y: "count",
            points: true,
            stroke: "var(--chart-1)",
            strokeWidth: 2.5,
          }),
        ],
        x: {
          scale: () => scalePoint<string>().padding(0.15),
          axis: {
            ticks: { format: (value) => formatDay(String(value), locale) },
          },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            ticks: {
              count: 5,
              format: (value) => Number(value).toLocaleString(locale),
            },
          },
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${formatDay(point.datum.date, locale)}: ${point.datum.count.toLocaleString(locale)}`,
        },
      }),
    [data, locale],
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
        {m.admin_chart_no_data()}
      </p>
    );
  }

  return (
    <figure className="grid gap-3">
      <Chart
        ariaLabel={title}
        className="text-muted-foreground min-h-64"
        definition={definition}
        height={260}
      />
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
  const locale = getLocale();
  const usersLabel = m.admin_project_connections_users();
  const organizationsLabel = m.admin_project_connections_organizations();
  const definition = useMemo(() => {
    const rows = data.flatMap((project) => [
      {
        projectId: project.projectId,
        projectName: project.projectName,
        connectionType: usersLabel,
        count: project.users,
      },
      {
        projectId: project.projectId,
        projectName: project.projectName,
        connectionType: organizationsLabel,
        count: project.organizations,
      },
    ]);

    return defineChart({
      marks: [
        barX(rows, {
          x: "count",
          y: "projectName",
          z: "connectionType",
          color: "connectionType",
          key: (row) => `${row.projectId}:${row.connectionType}`,
          layout: group({ padding: 0.16 }),
          inset: 1,
          radius: 3,
        }),
      ],
      x: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          ticks: {
            count: 5,
            format: (value) => Number(value).toLocaleString(locale),
          },
        },
      },
      y: {
        scale: () => scaleBand<string>().padding(0.2),
      },
      color: {
        domain: [usersLabel, organizationsLabel],
        range: ["var(--chart-1)", "oklch(0.78 0.09 72)"],
        legend: colorLegend(),
      },
      focus: "group-y",
      tooltip: {
        use: tooltip,
        anchor: "group-center",
        formatGroup: (points) =>
          [
            points[0]?.datum.projectName ?? "",
            ...points.map(
              (point) =>
                `${point.datum.connectionType}: ${point.datum.count.toLocaleString(locale)}`,
            ),
          ].join("\n"),
      },
    });
  }, [data, locale, organizationsLabel, usersLabel]);

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
        {m.admin_chart_no_data()}
      </p>
    );
  }

  return (
    <figure className="grid gap-3">
      <Chart
        ariaLabel={m.admin_project_connections_chart_title()}
        className="text-muted-foreground min-h-64"
        definition={definition}
        height={Math.max(260, data.length * 64)}
      />
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer">
          {m.admin_chart_view_data()}
        </summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-md border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              {m.admin_project_connections_chart_title()}
            </caption>
            <thead className="bg-muted/60 sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">
                  {m.project()}
                </th>
                <th className="px-3 py-2 text-right font-medium" scope="col">
                  {usersLabel}
                </th>
                <th className="px-3 py-2 text-right font-medium" scope="col">
                  {organizationsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((project) => (
                <tr className="border-t" key={project.projectId}>
                  <td className="px-3 py-2">{project.projectName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {project.users.toLocaleString(locale)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {project.organizations.toLocaleString(locale)}
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
