import { FeedbackInboxTable } from "@/components/admin/FeedbackInboxTable";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { fetchFeedbackSubmissions } from "@/lib/feedback/server";

export default async function AdminPage() {
  const feedbackSubmissions = await fetchFeedbackSubmissions();

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
              Feedback Inbox
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Latest product feedback
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              All submissions from the public feedback flow, ordered by most recent first. This
              view stays intentionally calm and read-only for Phase 1.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/90 shadow-sm">
        <CardContent className="p-0">
          {feedbackSubmissions.length === 0 ? (
            <div className="p-6">
              <Empty className="min-h-[220px] border-dashed bg-background/70">
                <EmptyHeader>
                  <EmptyTitle>No feedback submissions yet</EmptyTitle>
                  <EmptyDescription className="max-w-[42ch]">
                    New submissions from the public feedback prompt will appear here as they are
                    written to `feedback_submissions`.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <FeedbackInboxTable feedbackSubmissions={feedbackSubmissions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
