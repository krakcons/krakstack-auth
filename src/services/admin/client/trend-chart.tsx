import type { DailyActiveUsersByDay } from "@krak-stack/auth/admin";
import { areaY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { useMemo } from "react";

const formatDay = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export const TrendChart = ({
  data,
  title,
  valueLabel,
}: {
  data: ReadonlyArray<typeof DailyActiveUsersByDay.Type>;
  title: string;
  valueLabel: string;
}) => {
  const definition = useMemo(() => {
    const domainMax = Math.max(
      1,
      Math.ceil(Math.max(0, ...data.map(({ count }) => count)) * 1.1),
    );
    const yScale = scaleLinear().domain([0, domainMax]);
    return defineChart({
      marks: [
        areaY(data, {
          x: "date",
          y1: 0,
          y2: "count",
          fill: "var(--chart-1)",
          fillOpacity: 0.2,
          stroke: "var(--chart-1)",
          strokeWidth: 2,
        }),
      ],
      x: {
        scale: scalePoint<string>,
        grid: false,
        axis: {
          line: false,
          ticks: {
            size: 0,
            padding: 10,
            format: (value) => formatDay(String(value)),
          },
        },
      },
      y: {
        scale: yScale,
        grid: true,
        axis: {
          line: false,
          ticks: { values: yScale.ticks(5).filter(Number.isInteger), size: 0 },
        },
      },
      tooltip: {
        use: tooltip,
        items: [
          {
            channel: "y",
            label: valueLabel,
            text: (point) => point.datum.count.toLocaleString(),
          },
        ],
      },
    });
  }, [data, valueLabel]);
  return (
    <Chart
      ariaLabel={title}
      className="text-muted-foreground min-h-[260px] w-full text-xs"
      definition={definition}
      height={260}
    />
  );
};
