"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

type FeedbackTrendChartProps = {
  data: Array<{
    date: string;
    submissions: number;
  }>;
};

const chartConfig = {
  submissions: {
    label: "Feedback submissions",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

function formatTickLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function FeedbackTrendChart({ data }: FeedbackTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px]">
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
          tickFormatter={formatTickLabel}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
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
      </LineChart>
    </ChartContainer>
  );
}
