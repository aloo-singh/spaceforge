"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type FeedbackTrendChartProps = {
  data: Array<{
    date: string;
    submissions: number;
  }>;
  variant?: "full" | "sparkline";
  className?: string;
};

const chartConfig = {
  submissions: {
    label: "Feedback submissions",
    color: "hsl(var(--foreground))",
  },
} satisfies ChartConfig;

function formatTickLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTooltipValue(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function FeedbackTrendChart({
  data,
  variant = "full",
  className,
}: FeedbackTrendChartProps) {
  if (variant === "sparkline") {
    return (
      <ChartContainer
        config={chartConfig}
        className={cn("h-10 w-full [&_.recharts-surface]:overflow-visible", className)}
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{
            left: 1,
            right: 1,
            top: 3,
            bottom: 3,
          }}
        >
          <Line
            type="monotone"
            dataKey="submissions"
            stroke="var(--color-submissions)"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={cn("h-[320px]", className)}>
      <AreaChart
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
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          tickFormatter={formatTickLabel}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 6" }}
          labelFormatter={(label) => formatTickLabel(String(label))}
          formatter={(value) => formatTooltipValue(Number(value ?? 0))}
        />
        <Area
          type="monotone"
          dataKey="submissions"
          stroke="none"
          fill="var(--color-submissions)"
          fillOpacity={0.12}
        />
        <Line
          type="monotone"
          dataKey="submissions"
          stroke="var(--color-submissions)"
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: "var(--color-submissions)",
            stroke: "var(--color-background)",
            strokeWidth: 1.5,
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
