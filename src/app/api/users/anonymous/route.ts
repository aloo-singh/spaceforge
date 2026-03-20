import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppUserByClientToken } from "@/lib/projects/server";

type AnonymousUserRequestBody = {
  clientToken?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnonymousUserRequestBody;
    const clientToken = typeof body.clientToken === "string" ? body.clientToken.trim() : "";
    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }

    const user = await getOrCreateAppUserByClientToken(clientToken);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upsert anonymous user.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
