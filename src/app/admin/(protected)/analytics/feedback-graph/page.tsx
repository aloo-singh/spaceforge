import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FeedbackTrendChart } from "@/components/admin/FeedbackTrendChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FEEDBACK_GRAPH_DAYS, fetchAdminFeedbackTrend } from "@/lib/admin/analytics";

export default async function AdminFeedbackGraphPage() {
  const feedbackTrend = await fetchAdminFeedbackTrend(FEEDBACK_GRAPH_DAYS);
  const totalSubmissions = feedbackTrend.reduce((total, point) => total + point.submissions, 0);

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
              Feedback analytics
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Feedback submissions graph
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Daily feedback submission volume over the last {FEEDBACK_GRAPH_DAYS} days, kept
              intentionally calm and monochrome-first for quick operational review.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/80 p-5">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Window total
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(totalSubmissions)}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Total feedback submissions recorded across the current {FEEDBACK_GRAPH_DAYS}-day
                window.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/90 shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Daily trend
            </p>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Last {FEEDBACK_GRAPH_DAYS} days
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Each point reflects a UTC day in `feedback_submissions`, with the chart expanded
                here for a more readable trend line than the inbox sparkline.
              </p>
            </div>
          </div>

          <FeedbackTrendChart data={feedbackTrend} />
        </CardContent>
      </Card>
    </div>
  );
}
