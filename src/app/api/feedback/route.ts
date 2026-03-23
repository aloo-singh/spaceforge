import { NextRequest, NextResponse } from "next/server";
import { createFeedbackSubmission } from "@/lib/feedback/server";
import {
  isFeedbackMetadata,
  isFeedbackPageContext,
  isFeedbackSentiment,
  isFeedbackSource,
} from "@/lib/feedback/types";

type FeedbackRequestBody = {
  clientToken?: unknown;
  projectId?: unknown;
  pageContext?: unknown;
  source?: unknown;
  sentiment?: unknown;
  freeText?: unknown;
  timeSinceOpenSeconds?: unknown;
  promptVariant?: unknown;
  metadata?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FeedbackRequestBody;
    const clientToken = typeof body.clientToken === "string" ? body.clientToken.trim() : "";
    const projectId =
      body.projectId === null || body.projectId === undefined
        ? null
        : typeof body.projectId === "string" && body.projectId.trim().length > 0
          ? body.projectId.trim()
          : null;
    const freeText = typeof body.freeText === "string" ? body.freeText.trim() : "";
    const promptVariant =
      body.promptVariant === null || body.promptVariant === undefined
        ? null
        : typeof body.promptVariant === "string" && body.promptVariant.trim().length > 0
          ? body.promptVariant.trim()
          : null;

    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }
    if (!isFeedbackPageContext(body.pageContext)) {
      return NextResponse.json({ error: "pageContext is invalid." }, { status: 400 });
    }
    if (!isFeedbackSource(body.source)) {
      return NextResponse.json({ error: "source is invalid." }, { status: 400 });
    }
    if (!isFeedbackSentiment(body.sentiment)) {
      return NextResponse.json({ error: "sentiment is invalid." }, { status: 400 });
    }
    if (!freeText) {
      return NextResponse.json({ error: "freeText is required." }, { status: 400 });
    }
    if (
      typeof body.timeSinceOpenSeconds !== "number" ||
      !Number.isFinite(body.timeSinceOpenSeconds) ||
      body.timeSinceOpenSeconds < 0
    ) {
      return NextResponse.json(
        { error: "timeSinceOpenSeconds must be a non-negative number." },
        { status: 400 }
      );
    }
    if (body.metadata !== undefined && body.metadata !== null && !isFeedbackMetadata(body.metadata)) {
      return NextResponse.json({ error: "metadata is invalid." }, { status: 400 });
    }

    const submission = await createFeedbackSubmission({
      clientToken,
      projectId,
      pageContext: body.pageContext,
      source: body.source,
      sentiment: body.sentiment,
      freeText,
      timeSinceOpenSeconds: Math.round(body.timeSinceOpenSeconds),
      promptVariant,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit feedback.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

