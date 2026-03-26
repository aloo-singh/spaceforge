import {
  type FeedbackMetadata,
  type FeedbackSubmissionInput,
  type FeedbackSubmissionRecord,
  isFeedbackMetadata,
  isFeedbackPageContext,
  isFeedbackSentiment,
  isFeedbackSource,
} from "@/lib/feedback/types";
import { getOrCreateAppUserByClientToken } from "@/lib/projects/server";
import { getSupabaseServerConfig } from "@/lib/supabase/server";

type SupabaseFeedbackSubmissionRow = {
  id: string;
  app_user_id: string;
  project_id: string | null;
  client_token: string;
  page_context: string;
  source: string;
  sentiment: string;
  free_text: string;
  time_since_open_seconds: number;
  prompt_variant: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

function createFeedbackSubmissionsSearchParams() {
  return new URLSearchParams({
    select:
      "id,app_user_id,project_id,client_token,page_context,source,sentiment,free_text,time_since_open_seconds,prompt_variant,metadata,is_read,read_at,created_at",
    order: "created_at.desc",
  });
}

function assertSupabaseConfig() {
  const config = getSupabaseServerConfig();
  if (!config) {
    throw new Error("Missing Supabase server configuration.");
  }

  return config;
}

async function feedbackRequest(pathname: string, init: RequestInit) {
  const config = assertSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase feedback request failed: ${response.status} ${errorText}`);
  }

  return response;
}

function mapFeedbackSubmissionRecord(row: SupabaseFeedbackSubmissionRow): FeedbackSubmissionRecord {
  if (!isFeedbackPageContext(row.page_context)) {
    throw new Error(`Feedback submission ${row.id} has an invalid page context.`);
  }
  if (!isFeedbackSource(row.source)) {
    throw new Error(`Feedback submission ${row.id} has an invalid source.`);
  }
  if (!isFeedbackSentiment(row.sentiment)) {
    throw new Error(`Feedback submission ${row.id} has an invalid sentiment.`);
  }
  if (row.metadata !== null && !isFeedbackMetadata(row.metadata)) {
    throw new Error(`Feedback submission ${row.id} has invalid metadata.`);
  }

  return {
    id: row.id,
    appUserId: row.app_user_id,
    projectId: row.project_id,
    clientToken: row.client_token,
    pageContext: row.page_context,
    source: row.source,
    sentiment: row.sentiment,
    freeText: row.free_text,
    timeSinceOpenSeconds: row.time_since_open_seconds,
    promptVariant: row.prompt_variant,
    metadata: row.metadata as FeedbackMetadata | null,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function createFeedbackSubmission(
  input: FeedbackSubmissionInput
): Promise<FeedbackSubmissionRecord> {
  const user = await getOrCreateAppUserByClientToken(input.clientToken);
  const response = await feedbackRequest("feedback_submissions", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      app_user_id: user.id,
      project_id: input.projectId ?? null,
      client_token: input.clientToken,
      page_context: input.pageContext,
      source: input.source,
      sentiment: input.sentiment,
      free_text: input.freeText,
      time_since_open_seconds: input.timeSinceOpenSeconds,
      prompt_variant: input.promptVariant ?? null,
      metadata: input.metadata ?? null,
    }),
  });
  const rows = (await response.json()) as SupabaseFeedbackSubmissionRow[];
  const row = rows[0];

  if (!row) {
    throw new Error("Supabase feedback insert returned no row.");
  }

  return mapFeedbackSubmissionRecord(row);
}

export async function fetchFeedbackSubmissions(): Promise<FeedbackSubmissionRecord[]> {
  const config = assertSupabaseConfig();
  const url = new URL("/rest/v1/feedback_submissions", config.url);
  url.search = createFeedbackSubmissionsSearchParams().toString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase feedback query failed: ${response.status} ${errorText}`);
  }

  const rows = (await response.json()) as SupabaseFeedbackSubmissionRow[];
  return rows.map(mapFeedbackSubmissionRecord);
}

export async function fetchUnreadFeedbackSubmissionCount(): Promise<number> {
  const config = assertSupabaseConfig();
  const url = new URL("/rest/v1/feedback_submissions", config.url);
  url.search = new URLSearchParams({
    select: "id",
    is_read: "is.false",
    limit: "1",
  }).toString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "count=exact",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase feedback query failed: ${response.status} ${errorText}`);
  }

  const contentRange = response.headers.get("content-range");
  const totalCount = contentRange?.split("/")[1];
  if (totalCount) {
    const parsedCount = Number.parseInt(totalCount, 10);
    if (Number.isFinite(parsedCount)) {
      return parsedCount;
    }
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  return rows.length;
}

export async function markFeedbackSubmissionAsRead(submissionId: string) {
  const readAt = new Date().toISOString();
  const query = new URLSearchParams({
    id: `eq.${submissionId}`,
    is_read: "is.false",
  });

  await feedbackRequest(`feedback_submissions?${query.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      is_read: true,
      read_at: readAt,
    }),
  });
}

export async function markAllFeedbackSubmissionsAsRead() {
  const readAt = new Date().toISOString();
  const query = new URLSearchParams({
    is_read: "is.false",
  });

  await feedbackRequest(`feedback_submissions?${query.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      is_read: true,
      read_at: readAt,
    }),
  });
}
