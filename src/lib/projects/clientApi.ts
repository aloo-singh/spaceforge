"use client";

import type { EditorDocumentState } from "@/lib/editor/history";
import { cloneProjectDocument, type AppUser, type ProjectListItem, type ProjectRecord } from "@/lib/projects/types";

export class ProjectApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProjectApiError";
    this.status = status;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ProjectApiError(payload?.error ?? `Request failed with status ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}

export async function createOrFetchAnonymousUser(clientToken: string) {
  const response = await fetch("/api/users/anonymous", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientToken }),
  });
  const payload = await readJson<{ user: AppUser }>(response);
  return payload.user;
}

export async function fetchProjects(clientToken: string) {
  const searchParams = new URLSearchParams({
    clientToken,
  });
  const response = await fetch(`/api/projects?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson<{ projects: ProjectListItem[] }>(response);
  return payload.projects;
}

export async function fetchProjectsSafely(clientToken: string) {
  try {
    return await fetchProjects(clientToken);
  } catch (error) {
    if (error instanceof ProjectApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createProject(
  clientToken: string,
  input: {
    name: string;
    document: EditorDocumentState;
  }
) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientToken,
      name: input.name,
      document: cloneProjectDocument(input.document),
    }),
  });
  const payload = await readJson<{ project: ProjectRecord }>(response);
  return payload.project;
}

export async function fetchProject(clientToken: string, projectId: string) {
  const searchParams = new URLSearchParams({
    clientToken,
  });
  const response = await fetch(`/api/projects/${projectId}?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson<{ project: ProjectRecord }>(response);
  return payload.project;
}

export async function fetchProjectSafely(clientToken: string, projectId: string) {
  try {
    return await fetchProject(clientToken, projectId);
  } catch (error) {
    if (error instanceof ProjectApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function updateProject(
  clientToken: string,
  projectId: string,
  updates: {
    name?: string;
    document?: EditorDocumentState;
  }
) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientToken,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.document !== undefined
        ? { document: cloneProjectDocument(updates.document) }
        : {}),
    }),
  });
  const payload = await readJson<{ project: ProjectRecord }>(response);
  return payload.project;
}
