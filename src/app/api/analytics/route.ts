import { NextResponse } from "next/server";
import { persistAnalyticsEvent } from "@/lib/analytics/server";
import { isAnalyticsEvent } from "@/lib/analytics/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isAnalyticsEvent(payload)) {
    return NextResponse.json({ error: "Invalid analytics event payload." }, { status: 400 });
  }

  try {
    const result = await persistAnalyticsEvent(payload);
    return NextResponse.json({ ok: true, ...result }, { status: result.persisted ? 201 : 202 });
  } catch (error) {
    console.error("Analytics ingest failed.", error);
    return NextResponse.json({ error: "Failed to persist analytics event." }, { status: 500 });
  }
}
