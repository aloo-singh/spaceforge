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
  created_at: string;
};

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
    throw new Error(`Supabase feedback insert failed: ${response.status} ${errorText}`);
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
