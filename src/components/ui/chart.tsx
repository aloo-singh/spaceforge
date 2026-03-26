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
          "h-[240px] w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[hsl(var(--foreground)/0.92)] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[1.75] [&_.recharts-curve.recharts-tooltip-cursor]:opacity-100 [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-default-tooltip]:rounded-lg [&_.recharts-default-tooltip]:border [&_.recharts-default-tooltip]:border-border/80 [&_.recharts-default-tooltip]:bg-popover [&_.recharts-default-tooltip]:text-popover-foreground [&_.recharts-default-tooltip]:shadow-md [&_.recharts-tooltip-item]:text-popover-foreground [&_.recharts-tooltip-label]:text-popover-foreground",
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

type ChartTooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: unknown;
    name?: unknown;
    value?: unknown;
  }>;
  formatLabel?: (value: string) => string;
  formatValue?: (value: number) => string;
};

function ChartTooltipContent({
  active,
  label,
  payload,
  formatLabel,
  formatValue,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const firstItem = payload.find((item) => item.value !== undefined);

  if (!firstItem) {
    return null;
  }

  const resolvedLabel = typeof label === "string" ? label : String(label ?? "");
  const resolvedValue = Number(firstItem.value ?? 0);
  const seriesLabel =
    typeof firstItem.name === "string" && firstItem.name.length > 0 ? firstItem.name : "Value";

  return (
    <div className="min-w-[120px] rounded-lg border border-white/20 bg-[#111318] px-3 py-2 shadow-xl">
      <p className="mb-1 text-[12px] font-medium text-white">
        {formatLabel ? formatLabel(resolvedLabel) : resolvedLabel}
      </p>
      <div className="flex items-center justify-between gap-3 text-[12px] text-white">
        <span className="text-white/88">{seriesLabel}</span>
        <span className="font-medium">{formatValue ? formatValue(resolvedValue) : resolvedValue}</span>
      </div>
    </div>
  );
}

type ChartTooltipCursorProps = {
  height?: number;
  points?: ReadonlyArray<{
    x: number;
    y: number;
  }>;
  y?: number;
};

function ChartTooltipCursor({ height = 0, points, y = 0 }: ChartTooltipCursorProps) {
  const x = points?.[0]?.x;

  if (typeof x !== "number") {
    return null;
  }

  return (
    <line
      x1={x}
      x2={x}
      y1={y}
      y2={y + height}
      stroke="rgba(255, 255, 255, 0.55)"
      strokeWidth={1.5}
    />
  );
}

export {
  ChartContainer,
  ChartTooltipContent,
  ChartTooltipCursor,
  ChartContext,
};
