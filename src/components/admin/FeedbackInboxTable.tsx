"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

export function FeedbackInboxTable({ feedbackSubmissions }: FeedbackInboxTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {feedbackSubmissions.map((submission) => {
          const trimmedFreeText = submission.freeText.trim();
          const isExpandable = trimmedFreeText.length > 0;
          const isExpanded = expandedId === submission.id;

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
                <TableCell className="whitespace-nowrap px-3 py-3 align-top font-measurement text-[13px] text-foreground/80">
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
                <TableCell className="px-3 py-3 align-top text-sm text-foreground/75">
                  {formatPageContext(submission.pageContext)}
                </TableCell>
                <TableCell className="px-3 py-3 align-top text-sm text-foreground/75">
                  {formatSource(submission.source)}
                </TableCell>
                <TableCell className="max-w-[440px] px-3 py-3 align-top text-sm leading-6 text-foreground/75">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "min-w-0 flex-1",
                        !isExpanded && "line-clamp-2",
                        !trimmedFreeText && "italic text-muted-foreground"
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
              </TableRow>
              {isExpandable && isExpanded ? (
                <TableRow className="bg-muted/[0.14] hover:bg-muted/[0.14]">
                  <TableCell className="px-3 pt-0 pb-4" colSpan={6}>
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
  );
}
