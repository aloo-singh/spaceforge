import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AnalyticsMetricTrendChart } from "@/components/admin/AnalyticsMetricTrendChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsMetricDetail } from "@/lib/admin/analytics";

type AnalyticsMetricDetailViewProps = {
  metric: AnalyticsMetricDetail;
};

export function AnalyticsMetricDetailView({ metric }: AnalyticsMetricDetailViewProps) {
  const chartVariant = metric.slug === "total-rooms-created" ? "area" : "line";

  return (
    <div className="w-full space-y-4">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-0 text-foreground/65 hover:bg-transparent hover:text-foreground"
        >
          <Link href="/admin/analytics">
            <ArrowLeft className="size-4" />
            Back to analytics
          </Link>
        </Button>
      </div>

      <Card className="w-full border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
              Analytics
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{metric.label}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {metric.description}
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/80 p-5">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Current readout
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
              <p className="text-sm leading-6 text-muted-foreground">{metric.detail}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/90 shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Detail
            </p>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {metric.chartTitle}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">{metric.chartDescription}</p>
            </div>
          </div>

          <AnalyticsMetricTrendChart
            data={metric.data}
            seriesLabel={metric.label}
            valueType={metric.valueType}
            variant={chartVariant}
          />
        </CardContent>
      </Card>
    </div>
  );
}
