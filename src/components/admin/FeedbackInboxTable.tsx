"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  markAllFeedbackSubmissionsReadAction,
  markFeedbackSubmissionReadAction,
} from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FeedbackSubmissionRecord } from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

const createdAtDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const createdAtTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatCreatedAt(createdAt: string) {
  const date = new Date(createdAt);
  return `${createdAtDateFormatter.format(date)}, ${createdAtTimeFormatter.format(date)}`;
}

function formatSentiment(sentiment: FeedbackSubmissionRecord["sentiment"]) {
  return sentiment === "positive" ? "Positive" : "Negative";
}

function formatPageContext(pageContext: FeedbackSubmissionRecord["pageContext"]) {
  return pageContext === "editor" ? "Editor" : "Projects";
}

function formatSource(source: FeedbackSubmissionRecord["source"]) {
  return source === "manual_button" ? "Manual button" : "Prompt";
}

function formatTiming(timeSinceOpenSeconds: number) {
  return `${timeSinceOpenSeconds} sec after open`;
}

function getFreeTextPreview(freeText: string) {
  const trimmedText = freeText.trim();

  if (!trimmedText) {
    return "No written feedback";
  }

  return trimmedText.length > 140 ? `${trimmedText.slice(0, 137)}...` : trimmedText;
}

function sentimentBadgeClassName(sentiment: FeedbackSubmissionRecord["sentiment"]) {
  return sentiment === "positive"
    ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
    : "border-rose-200/80 bg-rose-50 text-rose-800";
}

type FeedbackInboxTableProps = {
  feedbackSubmissions: FeedbackSubmissionRecord[];
};

type FeedbackInboxFilter = "unread" | "all";

function MarkReadButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" size="xs" disabled={pending}>
      {pending ? "Marking..." : "Mark read"}
    </Button>
  );
}

function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" size="sm" disabled={disabled || pending}>
      {pending ? "Marking..." : "Mark all as read"}
    </Button>
  );
}

export function FeedbackInboxTable({ feedbackSubmissions }: FeedbackInboxTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FeedbackInboxFilter>("unread");
  const unreadCount = useMemo(
    () => feedbackSubmissions.filter((submission) => !submission.isRead).length,
    [feedbackSubmissions]
  );
  const visibleSubmissions = useMemo(
    () =>
      activeFilter === "unread"
        ? feedbackSubmissions.filter((submission) => !submission.isRead)
        : feedbackSubmissions,
    [activeFilter, feedbackSubmissions]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-border/70 bg-background/70 p-1">
            <Button
              type="button"
              variant={activeFilter === "unread" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("unread")}
              aria-pressed={activeFilter === "unread"}
            >
              Unread
            </Button>
            <Button
              type="button"
              variant={activeFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("all")}
              aria-pressed={activeFilter === "all"}
            >
              All
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread {unreadCount === 1 ? "item" : "items"}
          </p>
        </div>

        <form action={markAllFeedbackSubmissionsReadAction}>
          <MarkAllReadButton disabled={unreadCount === 0} />
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 w-[170px] px-3 py-2 font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Created
            </TableHead>
            <TableHead className="h-10 w-[132px] px-3 py-2 font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Sentiment
            </TableHead>
            <TableHead className="h-10 w-[112px] px-3 py-2 font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Page
            </TableHead>
            <TableHead className="h-10 w-[132px] px-3 py-2 font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Source
            </TableHead>
            <TableHead className="h-10 px-3 py-2 font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Free text
            </TableHead>
            <TableHead className="h-10 w-[150px] px-3 py-2 font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Timing
            </TableHead>
            <TableHead className="h-10 w-[126px] px-3 py-2 text-right font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleSubmissions.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">
                {activeFilter === "unread"
                  ? "Everything is read. Switch to All to review the full inbox."
                  : "No feedback submissions match this view."}
              </TableCell>
            </TableRow>
          ) : null}
        {visibleSubmissions.map((submission) => {
          const trimmedFreeText = submission.freeText.trim();
          const isExpandable = trimmedFreeText.length > 0;
          const isExpanded = expandedId === submission.id;
          const isUnread = !submission.isRead;

          const handleToggle = () => {
            if (!isExpandable) {
              return;
            }

            setExpandedId((currentId) => (currentId === submission.id ? null : submission.id));
          };

          return (
            <Fragment key={submission.id}>
              <TableRow
                aria-expanded={isExpandable ? isExpanded : undefined}
                className={cn(
                  "group",
                  isUnread && "bg-background",
                  isExpandable && "cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30"
                )}
                onClick={handleToggle}
                onKeyDown={(event) => {
                  if (!isExpandable) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleToggle();
                  }
                }}
                role={isExpandable ? "button" : undefined}
                tabIndex={isExpandable ? 0 : undefined}
              >
                <TableCell
                  className={cn(
                    "whitespace-nowrap border-l-2 px-3 py-3 align-top font-measurement text-[13px]",
                    isUnread
                      ? "border-l-selected-surface-border font-semibold text-foreground/90"
                      : "border-l-transparent text-foreground/80"
                  )}
                >
                  {formatCreatedAt(submission.createdAt)}
                </TableCell>
                <TableCell className="px-3 py-3 align-top">
                  <Badge
                    variant="outline"
                    className={cn(
                      "min-w-[88px] justify-center font-medium",
                      sentimentBadgeClassName(submission.sentiment)
                    )}
                  >
                    {formatSentiment(submission.sentiment)}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn(
                    "px-3 py-3 align-top text-sm",
                    isUnread ? "font-medium text-foreground/85" : "text-foreground/75"
                  )}
                >
                  {formatPageContext(submission.pageContext)}
                </TableCell>
                <TableCell
                  className={cn(
                    "px-3 py-3 align-top text-sm",
                    isUnread ? "font-medium text-foreground/85" : "text-foreground/75"
                  )}
                >
                  {formatSource(submission.source)}
                </TableCell>
                <TableCell
                  className={cn(
                    "max-w-[440px] px-3 py-3 align-top text-sm leading-6",
                    isUnread ? "text-foreground/85" : "text-foreground/75"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "min-w-0 flex-1",
                        !isExpanded && "line-clamp-2",
                        !trimmedFreeText && "italic text-muted-foreground",
                        isUnread && trimmedFreeText && "font-medium"
                      )}
                    >
                      {isExpanded && trimmedFreeText ? trimmedFreeText : getFreeTextPreview(submission.freeText)}
                    </span>
                    {isExpandable ? (
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-3 align-top font-measurement text-[13px] text-muted-foreground">
                  {formatTiming(submission.timeSinceOpenSeconds)}
                </TableCell>
                <TableCell className="px-3 py-3 align-top">
                  <div
                    className="flex justify-end"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {isUnread ? (
                      <form action={markFeedbackSubmissionReadAction}>
                        <input type="hidden" name="submissionId" value={submission.id} />
                        <MarkReadButton />
                      </form>
                    ) : (
                      <span className="pt-1 text-xs font-medium text-muted-foreground">Read</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {isExpandable && isExpanded ? (
                <TableRow className="bg-muted/[0.14] hover:bg-muted/[0.14]">
                  <TableCell className="px-3 pt-0 pb-4" colSpan={7}>
                    <div className="rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm leading-6 text-foreground/80">
                      {trimmedFreeText}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
        </TableBody>
      </Table>
    </div>
  );
}
