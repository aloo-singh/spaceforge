"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsMetricDistributionPoint } from "@/lib/admin/analytics";

type AnalyticsMetricDistributionChartProps = {
  data: AnalyticsMetricDistributionPoint[];
};

function formatValue(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function AnalyticsMetricDistributionChart({
  data,
}: AnalyticsMetricDistributionChartProps) {
  const chartConfig = {
    sessions: {
      label: "Sessions",
      color: "var(--color-chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[280px]">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{
          left: 4,
          right: 12,
          top: 8,
          bottom: 4,
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="2 6" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
          tickFormatter={(value: number) => formatValue(value)}
        />
        <Tooltip
          cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
          content={({ active, label, payload }) => (
            <ChartTooltipContent
              active={active}
              label={label}
              payload={payload}
              formatValue={formatValue}
            />
          )}
        />
        <Bar dataKey="value" name="Sessions" radius={[8, 8, 0, 0]}>
          {data.map((point) => (
            <Cell
              key={point.label}
              fill={
                point.label === ">5m"
                  ? "hsl(var(--foreground) / 0.28)"
                  : "var(--color-sessions)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
