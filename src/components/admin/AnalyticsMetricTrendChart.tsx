"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  chartTooltipContentStyle,
  chartTooltipCursorStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  AnalyticsMetricDetailPoint,
  AnalyticsMetricValueType,
} from "@/lib/admin/analytics";

type AnalyticsMetricTrendChartProps = {
  data: AnalyticsMetricDetailPoint[];
  seriesLabel: string;
  valueType: AnalyticsMetricValueType;
  variant?: "line" | "area";
};

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDurationTick(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m`;
}

function formatValue(value: number, valueType: AnalyticsMetricValueType) {
  if (valueType === "percent") {
    return new Intl.NumberFormat("en-GB", {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (valueType === "duration") {
    return formatDurationTick(value);
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatYAxisTick(value: number, valueType: AnalyticsMetricValueType) {
  if (valueType === "duration") {
    return formatDurationTick(value);
  }

  return formatValue(value, valueType);
}

export function AnalyticsMetricTrendChart({
  data,
  seriesLabel,
  valueType,
  variant = "line",
}: AnalyticsMetricTrendChartProps) {
  const chartConfig = {
    value: {
      label: seriesLabel,
      color: "var(--color-chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[340px]">
      {variant === "area" ? (
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
            tickFormatter={formatDateLabel}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={36}
            domain={valueType === "percent" ? [0, 1] : ["auto", "auto"]}
            tickFormatter={(value: number) => formatYAxisTick(value, valueType)}
          />
          <Tooltip
            cursor={chartTooltipCursorStyle}
            contentStyle={chartTooltipContentStyle}
            itemStyle={chartTooltipItemStyle}
            labelFormatter={(label) => formatDateLabel(String(label))}
            formatter={(value) => formatValue(Number(value ?? 0), valueType)}
            labelStyle={chartTooltipLabelStyle}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            fill="var(--color-value)"
            fillOpacity={0.14}
            strokeWidth={2}
          />
        </AreaChart>
      ) : (
        <LineChart
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
            tickFormatter={formatDateLabel}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={36}
            domain={valueType === "percent" ? [0, 1] : ["auto", "auto"]}
            tickFormatter={(value: number) => formatYAxisTick(value, valueType)}
          />
          <Tooltip
            cursor={chartTooltipCursorStyle}
            contentStyle={chartTooltipContentStyle}
            itemStyle={chartTooltipItemStyle}
            labelFormatter={(label) => formatDateLabel(String(label))}
            formatter={(value) => formatValue(Number(value ?? 0), valueType)}
            labelStyle={chartTooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--color-value)",
              stroke: "var(--color-background)",
              strokeWidth: 1.5,
            }}
          />
        </LineChart>
      )}
    </ChartContainer>
  );
}
