"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, value]) => value.color);

  if (colorEntries.length === 0) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: colorEntries
          .map(([key, value]) => `[data-chart="${id}"] { --color-${key}: ${value.color}; }`)
          .join("\n"),
      }}
    />
  );
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const chartId = React.useId().replace(/:/g, "");

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={id ?? chartId}
        className={cn(
          "h-[240px] w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-default-tooltip]:rounded-lg [&_.recharts-default-tooltip]:border [&_.recharts-default-tooltip]:border-border/80 [&_.recharts-default-tooltip]:bg-popover [&_.recharts-default-tooltip]:text-popover-foreground [&_.recharts-default-tooltip]:shadow-md [&_.recharts-tooltip-item]:text-popover-foreground [&_.recharts-tooltip-label]:text-popover-foreground",
          className
        )}
        {...props}
      >
        <ChartStyle id={id ?? chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

const chartTooltipContentStyle = {
  backgroundColor: "hsl(var(--popover))",
  borderColor: "hsl(var(--border))",
  borderRadius: "calc(var(--radius) - 2px)",
  boxShadow: "0 10px 30px hsl(var(--foreground) / 0.08)",
  color: "hsl(var(--popover-foreground))",
} as const;

const chartTooltipLabelStyle = {
  color: "hsl(var(--popover-foreground))",
  fontWeight: 500,
  marginBottom: "0.25rem",
} as const;

const chartTooltipItemStyle = {
  color: "hsl(var(--popover-foreground))",
  padding: 0,
} as const;

const chartTooltipCursorStyle = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 6",
  strokeOpacity: 0.95,
  strokeWidth: 1.25,
} as const;

export {
  ChartContainer,
  ChartContext,
  chartTooltipContentStyle,
  chartTooltipCursorStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
};
