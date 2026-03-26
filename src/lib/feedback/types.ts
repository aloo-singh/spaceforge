export const FEEDBACK_PAGE_CONTEXTS = ["editor", "projects"] as const;
export const FEEDBACK_SOURCES = ["prompt", "manual_button"] as const;
export const FEEDBACK_SENTIMENTS = ["positive", "negative"] as const;
export const FEEDBACK_PROMPT_VARIANT = "expectation-check-v1";

export type FeedbackPageContext = (typeof FEEDBACK_PAGE_CONTEXTS)[number];
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];
export type FeedbackSentiment = (typeof FEEDBACK_SENTIMENTS)[number];
export type FeedbackMetadataValue = string | number | boolean | null;
export type FeedbackMetadata = Record<string, FeedbackMetadataValue>;

export type FeedbackSubmissionInput = {
  clientToken: string;
  projectId?: string | null;
  pageContext: FeedbackPageContext;
  source: FeedbackSource;
  sentiment: FeedbackSentiment;
  freeText: string;
  timeSinceOpenSeconds: number;
  promptVariant?: string | null;
  metadata?: FeedbackMetadata | null;
};

export type FeedbackSubmissionRecord = {
  id: string;
  appUserId: string;
  projectId: string | null;
  clientToken: string;
  pageContext: FeedbackPageContext;
  source: FeedbackSource;
  sentiment: FeedbackSentiment;
  freeText: string;
  timeSinceOpenSeconds: number;
  promptVariant: string | null;
  metadata: FeedbackMetadata | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFeedbackPageContext(value: unknown): value is FeedbackPageContext {
  return typeof value === "string" && FEEDBACK_PAGE_CONTEXTS.includes(value as FeedbackPageContext);
}

export function isFeedbackSource(value: unknown): value is FeedbackSource {
  return typeof value === "string" && FEEDBACK_SOURCES.includes(value as FeedbackSource);
}

export function isFeedbackSentiment(value: unknown): value is FeedbackSentiment {
  return typeof value === "string" && FEEDBACK_SENTIMENTS.includes(value as FeedbackSentiment);
}

export function isFeedbackMetadata(value: unknown): value is FeedbackMetadata {
  if (!isObject(value)) {
    return false;
  }

  return Object.values(value).every(
    (candidate) =>
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "number" ||
      typeof candidate === "boolean"
  );
}
