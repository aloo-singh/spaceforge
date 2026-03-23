import { NextRequest, NextResponse } from "next/server";
import type { EditorDocumentState } from "@/lib/editor/history";
import {
  deleteProjectForClientToken,
  fetchProjectForClientToken,
  updateProjectForClientToken,
} from "@/lib/projects/server";
import { isProjectDocument, isProjectThumbnailDataUrl } from "@/lib/projects/types";

type ProjectRouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

type UpdateProjectRequestBody = {
  clientToken?: unknown;
  name?: unknown;
  document?: unknown;
  thumbnailDataUrl?: unknown;
};

type DeleteProjectRequestBody = {
  clientToken?: unknown;
};

function getClientTokenFromSearchParams(request: NextRequest) {
  return request.nextUrl.searchParams.get("clientToken")?.trim() ?? "";
}

export async function GET(request: NextRequest, context: ProjectRouteContext) {
  try {
    const clientToken = getClientTokenFromSearchParams(request);
    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }

    const { projectId } = await context.params;
    const project = await fetchProjectForClientToken(clientToken, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch project.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, context: ProjectRouteContext) {
  try {
    const body = (await request.json()) as UpdateProjectRequestBody;
    const clientToken = typeof body.clientToken === "string" ? body.clientToken.trim() : "";
    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }

    const updates: {
      name?: string;
      document?: EditorDocumentState;
      thumbnailDataUrl?: string | null;
    } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string." }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    if (body.document !== undefined) {
      if (!isProjectDocument(body.document)) {
        return NextResponse.json({ error: "document is invalid." }, { status: 400 });
      }
      updates.document = body.document;
    }
    if (body.thumbnailDataUrl !== undefined) {
      if (!isProjectThumbnailDataUrl(body.thumbnailDataUrl)) {
        return NextResponse.json({ error: "thumbnailDataUrl is invalid." }, { status: 400 });
      }
      updates.thumbnailDataUrl = body.thumbnailDataUrl ?? null;
    }
    if (
      updates.name === undefined &&
      updates.document === undefined &&
      updates.thumbnailDataUrl === undefined
    ) {
      return NextResponse.json({ error: "No project updates were provided." }, { status: 400 });
    }

    const { projectId } = await context.params;
    const project = await updateProjectForClientToken(clientToken, projectId, updates);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: ProjectRouteContext) {
  try {
    const body = (await request.json()) as DeleteProjectRequestBody;
    const clientToken = typeof body.clientToken === "string" ? body.clientToken.trim() : "";
    if (!clientToken) {
      return NextResponse.json({ error: "clientToken is required." }, { status: 400 });
    }

    const { projectId } = await context.params;
    const project = await deleteProjectForClientToken(clientToken, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project.";
    const status = message.includes("Missing Supabase server configuration.") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
