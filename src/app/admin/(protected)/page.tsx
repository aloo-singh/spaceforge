import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchFeedbackSubmissions } from "@/lib/feedback/server";
import type { FeedbackSubmissionRecord } from "@/lib/feedback/types";

const createdAtFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatCreatedAt(createdAt: string) {
  return createdAtFormatter.format(new Date(createdAt));
}

function formatSentiment(sentiment: FeedbackSubmissionRecord["sentiment"]) {
  return sentiment === "positive" ? "Yes" : "Not really";
}

function formatPageContext(pageContext: FeedbackSubmissionRecord["pageContext"]) {
  return pageContext === "editor" ? "Editor" : "Projects";
}

function formatSource(source: FeedbackSubmissionRecord["source"]) {
  return source === "manual_button" ? "Manual button" : "Prompt";
}

function formatFreeText(freeText: string) {
  const trimmedText = freeText.trim();

  if (!trimmedText) {
    return "No written feedback";
  }

  return trimmedText.length > 120 ? `${trimmedText.slice(0, 117)}...` : trimmedText;
}

function sentimentBadgeClassName(sentiment: FeedbackSubmissionRecord["sentiment"]) {
  return sentiment === "positive"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[170px]">Created</TableHead>
                  <TableHead className="w-[120px]">Sentiment</TableHead>
                  <TableHead className="w-[120px]">Page</TableHead>
                  <TableHead className="w-[140px]">Source</TableHead>
                  <TableHead>Free text</TableHead>
                  <TableHead className="w-[180px]">Timing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="whitespace-nowrap text-sm text-foreground/80">
                      {formatCreatedAt(submission.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={sentimentBadgeClassName(submission.sentiment)}
                      >
                        {formatSentiment(submission.sentiment)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/75">
                      {formatPageContext(submission.pageContext)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/75">
                      {formatSource(submission.source)}
                    </TableCell>
                    <TableCell className="max-w-[420px] text-sm leading-6 text-foreground/75">
                      {formatFreeText(submission.freeText)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {submission.timeSinceOpenSeconds} seconds after open
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
