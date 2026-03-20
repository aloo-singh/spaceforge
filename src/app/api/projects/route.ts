import { NextRequest, NextResponse } from "next/server";
import { createProjectForClientToken, fetchProjectsForClientToken } from "@/lib/projects/server";
import { isProjectDocument } from "@/lib/projects/types";

type CreateProjectRequestBody = {
  clientToken?: unknown;
  name?: unknown;
  document?: unknown;
};

function getClientTokenFromSearchParams(request: NextRequest) {
  return request.nextUrl.searchParams.get("clientToken")?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const clientToken = getClientTokenFromSearchParams(request);
    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }

    const projects = await fetchProjectsForClientToken(clientToken);
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch projects.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProjectRequestBody;
    const clientToken = typeof body.clientToken === "string" ? body.clientToken.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }
    if (!isProjectDocument(body.document)) {
      return NextResponse.json({ error: "document is invalid." }, { status: 400 });
    }

    const project = await createProjectForClientToken(clientToken, {
      name,
      document: body.document,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
