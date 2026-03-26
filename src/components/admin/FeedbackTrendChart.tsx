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

import {
  ChartContainer,
  chartTooltipContentStyle,
  chartTooltipCursorStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type FeedbackTrendChartProps = {
  data: Array<{
    date: string;
    submissions: number;
  }>;
  variant?: "compact" | "full" | "sparkline";
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
        className={cn("h-5 w-full [&_.recharts-surface]:overflow-visible", className)}
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{
            left: 0,
            right: 0,
            top: 1,
            bottom: 1,
          }}
        >
          <Line
            type="monotone"
            dataKey="submissions"
            stroke="var(--color-submissions)"
            strokeOpacity={0.62}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(variant === "compact" ? "h-[180px]" : "h-[320px]", className)}
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{
          left: variant === "compact" ? 0 : 4,
          right: variant === "compact" ? 8 : 12,
          top: variant === "compact" ? 4 : 8,
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
          width={variant === "compact" ? 24 : 28}
        />
        <Tooltip
          cursor={chartTooltipCursorStyle}
          contentStyle={chartTooltipContentStyle}
          itemStyle={chartTooltipItemStyle}
          labelFormatter={(label) => formatTickLabel(String(label))}
          formatter={(value) => formatTooltipValue(Number(value ?? 0))}
          labelStyle={chartTooltipLabelStyle}
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
          strokeWidth={variant === "compact" ? 1.8 : 2}
          dot={false}
          activeDot={{
            r: variant === "compact" ? 3.5 : 4,
            fill: "var(--color-submissions)",
            stroke: "var(--color-background)",
            strokeWidth: 1.5,
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
