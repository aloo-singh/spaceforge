import { FeedbackTrendChart } from "@/components/admin/FeedbackTrendChart";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAdminAnalyticsDashboardData } from "@/lib/admin/analytics";

export default async function AdminAnalyticsPage() {
  const dashboard = await fetchAdminAnalyticsDashboardData();

  return (
    <div className="w-full space-y-4">
      <Card className="w-full border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 p-6">
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
          <Card key={metric.label} className="border-border/70 bg-background/90 shadow-sm">
            <CardContent className="space-y-3 p-6">
              <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
                {metric.label}
              </p>
              <div className="space-y-1">
                <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
                <p className="text-sm leading-6 text-muted-foreground">{metric.detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-background/90 shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Feedback trend
            </p>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Feedback submissions over the last 30 days
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Daily volume only, intentionally kept simple for foundation scope.
              </p>
            </div>
          </div>

          <FeedbackTrendChart data={dashboard.feedbackTrend} />
        </CardContent>
      </Card>
    </div>
  );
}
