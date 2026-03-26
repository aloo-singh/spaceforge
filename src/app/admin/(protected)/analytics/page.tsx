import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined } from "lucide-react";

import { FeedbackTrendChart } from "@/components/admin/FeedbackTrendChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAdminAnalyticsDashboardData } from "@/lib/admin/analytics";
import { cn } from "@/lib/utils";

export default async function AdminAnalyticsPage() {
  const dashboard = await fetchAdminAnalyticsDashboardData();

  return (
    <div className="w-full space-y-5">
      <Card className="w-full border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
              Analytics
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Internal product telemetry
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              A minimal operational readout for the current product surface. The dashboard stays
              lightweight and monochrome-first while exposing the key signals already captured in
              `analytics_events` and `feedback_submissions`.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metricCards.map((metric) => (
          <Link key={metric.slug} href={metric.href} className="group block focus-visible:outline-none">
            <Card
              className={cn(
                "shadow-sm transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring/50",
                metric.tone === "alert"
                  ? "border-red-300/80 bg-red-50/55 group-hover:border-red-400/90 group-hover:bg-red-50/75 dark:border-red-900/70 dark:bg-red-950/25 dark:group-hover:border-red-800/85 dark:group-hover:bg-red-950/35"
                  : "border-border/70 bg-background/90 group-hover:border-foreground/20 group-hover:bg-background"
              )}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={cn(
                      "font-measurement text-[10px] font-semibold tracking-[0.16em] uppercase",
                      metric.tone === "alert"
                        ? "text-red-800/85 dark:text-red-200/85"
                        : "text-foreground/45"
                    )}
                  >
                    {metric.label}
                  </p>
                  <ArrowRight
                    className={cn(
                      "mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                      metric.tone === "alert"
                        ? "text-red-800/55 group-hover:text-red-800/80 dark:text-red-200/55 dark:group-hover:text-red-200/80"
                        : "text-foreground/35 group-hover:text-foreground/60"
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{metric.detail}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/70 bg-background/90 shadow-sm">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
                Feedback trend
              </p>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Feedback submissions over the last 30 days
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  A compact operational readout of daily submission volume, with the full graph kept
                  one click away.
                </p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-2 px-0 text-foreground/65 hover:bg-transparent hover:text-foreground">
              <Link href="/admin/analytics/feedback-graph">
                <ChartNoAxesCombined className="size-4" />
                Open full graph
              </Link>
            </Button>
          </div>

          <FeedbackTrendChart data={dashboard.feedbackTrend} variant="compact" />
        </CardContent>
      </Card>
    </div>
  );
}
