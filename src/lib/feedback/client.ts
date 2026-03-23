"use client";

import {
  isFeedbackMetadata,
  isFeedbackPageContext,
  isFeedbackSentiment,
  isFeedbackSource,
  type FeedbackSubmissionInput,
  type FeedbackSubmissionRecord,
} from "@/lib/feedback/types";

export class FeedbackApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FeedbackApiError";
    this.status = status;
  }
}

type FeedbackApiResponse = {
  submission: FeedbackSubmissionRecord;
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = ((await response.json().catch(() => null)) as { error?: string } | null) ?? null;
    throw new FeedbackApiError(
      payload?.error ?? `Request failed with status ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
}

export async function submitFeedback(input: FeedbackSubmissionInput) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readJson<FeedbackApiResponse>(response);
  return payload.submission;
}

export function isFeedbackSubmissionRecord(value: unknown): value is FeedbackSubmissionRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.appUserId === "string" &&
    (typeof record.projectId === "string" || record.projectId === null) &&
    typeof record.clientToken === "string" &&
    isFeedbackPageContext(record.pageContext) &&
    isFeedbackSource(record.source) &&
    isFeedbackSentiment(record.sentiment) &&
    typeof record.freeText === "string" &&
    typeof record.timeSinceOpenSeconds === "number" &&
    (typeof record.promptVariant === "string" || record.promptVariant === null) &&
    (record.metadata === null || isFeedbackMetadata(record.metadata)) &&
    typeof record.createdAt === "string"
  );
}

