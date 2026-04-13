"use client";

import type { EditorDocumentState } from "@/lib/editor/history";
import {
  loadCachedProject,
  loadCachedProjectListForClientToken,
  removeCachedProject,
  upsertCachedProject,
} from "@/lib/projects/localCache";
import { cloneProjectDocument, type AppUser, type ProjectListItem, type ProjectRecord } from "@/lib/projects/types";

export class ProjectApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProjectApiError";
    this.status = status;
  }
}

function warnProjectRecovery(message: string, details?: unknown) {
  console.warn(`[spaceforge] ${message}`, details);
}

function createLocalFallbackUser(clientToken: string): AppUser {
  const now = new Date().toISOString();
  return {
    id: `local-user:${clientToken}`,
    clientToken,
    createdAt: now,
    updatedAt: now,
  };
}

function createLocalFallbackProject(
  clientToken: string,
  input: {
    projectId?: string;
    name: string;
    document: EditorDocumentState;
    thumbnailDataUrl?: string | null;
  }
): ProjectRecord {
  const now = new Date().toISOString();

  return {
    id:
      input.projectId ??
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `local-project-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
    userId: `local-user:${clientToken}`,
    name: input.name,
    document: cloneProjectDocument(input.document),
    thumbnailDataUrl: input.thumbnailDataUrl ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null;

    throw new ProjectApiError(
      payload?.error ??
        (response.status === 404
          ? "Projects API unavailable."
          : `Request failed with status ${response.status}.`),
      response.status
    );
  }

  return (await response.json()) as T;
}

export async function createOrFetchAnonymousUser(clientToken: string) {
  try {
    const response = await fetch("/api/users/anonymous", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientToken }),
    });
    const payload = await readJson<{ user: AppUser }>(response);
    return payload.user;
  } catch (error) {
    warnProjectRecovery("Falling back to a local anonymous session because the user bootstrap request failed.", error);
    return createLocalFallbackUser(clientToken);
  }
}

export async function fetchProjects(clientToken: string) {
  try {
    const searchParams = new URLSearchParams({
      clientToken,
    });
    const response = await fetch(`/api/projects?${searchParams.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await readJson<{ projects: ProjectListItem[] }>(response);
    if (payload.projects.length > 0) {
      return payload.projects;
    }

    const cachedProjects = loadCachedProjectListForClientToken(clientToken);
    if (cachedProjects.length > 0) {
      warnProjectRecovery("Projects API returned no projects. Recovering projects from local cache.");
      return cachedProjects;
    }

    return payload.projects;
  } catch (error) {
    const cachedProjects = loadCachedProjectListForClientToken(clientToken);
    if (cachedProjects.length > 0) {
      warnProjectRecovery("Projects request failed. Falling back to locally cached projects.", error);
      return cachedProjects;
    }

    throw error;
  }
}

export async function fetchProjectPresence(clientToken: string) {
  try {
    const searchParams = new URLSearchParams({
      clientToken,
      mode: "presence",
    });
    const response = await fetch(`/api/projects?${searchParams.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await readJson<{ hasProjects: boolean }>(response);
    if (payload.hasProjects) {
      return true;
    }

    const cachedProjects = loadCachedProjectListForClientToken(clientToken);
    return cachedProjects.length > 0;
  } catch (error) {
    const cachedProjects = loadCachedProjectListForClientToken(clientToken);
    if (cachedProjects.length > 0) {
      warnProjectRecovery("Project presence request failed. Falling back to local cached projects.", error);
      return true;
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
  const normalizedDocument = cloneProjectDocument(input.document);

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientToken,
        name: input.name,
        document: normalizedDocument,
      }),
    });
    const payload = await readJson<{ project: ProjectRecord }>(response);
    return upsertCachedProject(clientToken, payload.project);
  } catch (error) {
    warnProjectRecovery("Project creation failed remotely. Saving a local recovery copy instead.", error);
    return upsertCachedProject(
      clientToken,
      createLocalFallbackProject(clientToken, {
        name: input.name,
        document: normalizedDocument,
      })
    );
  }
}

export async function fetchProject(clientToken: string, projectId: string) {
  try {
    const searchParams = new URLSearchParams({
      clientToken,
    });
    const response = await fetch(`/api/projects/${projectId}?${searchParams.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await readJson<{ project: ProjectRecord }>(response);
    return upsertCachedProject(clientToken, payload.project);
  } catch (error) {
    const cachedProject = loadCachedProject(projectId);
    if (cachedProject) {
      warnProjectRecovery(`Project ${projectId} could not be fetched remotely. Recovering from local cache.`, error);
      return upsertCachedProject(clientToken, cachedProject);
    }

    throw error;
  }
}

export async function fetchProjectSafely(clientToken: string, projectId: string) {
  try {
    return await fetchProject(clientToken, projectId);
  } catch (error) {
    if (isSpecificProjectNotFoundError(error)) {
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
    thumbnailDataUrl?: string | null;
  }
) {
  const normalizedDocument = updates.document !== undefined ? cloneProjectDocument(updates.document) : undefined;

  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientToken,
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(normalizedDocument !== undefined
          ? { document: normalizedDocument }
          : {}),
        ...(updates.thumbnailDataUrl !== undefined
          ? { thumbnailDataUrl: updates.thumbnailDataUrl }
          : {}),
      }),
    });
    const payload = await readJson<{ project: ProjectRecord }>(response);
    return upsertCachedProject(clientToken, payload.project);
  } catch (error) {
    const cachedProject = loadCachedProject(projectId);
    if (!cachedProject) {
      throw error;
    }

    warnProjectRecovery(`Project ${projectId} update failed remotely. Saving changes to local cache instead.`, error);
    return upsertCachedProject(clientToken, {
      ...cachedProject,
      name: updates.name ?? cachedProject.name,
      document: normalizedDocument ?? cachedProject.document,
      thumbnailDataUrl:
        updates.thumbnailDataUrl !== undefined ? updates.thumbnailDataUrl : cachedProject.thumbnailDataUrl,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function deleteProject(clientToken: string, projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientToken,
      }),
    });
    const payload = await readJson<{ project: ProjectRecord }>(response);
    removeCachedProject(projectId);
    return payload.project;
  } catch (error) {
    const cachedProject = removeCachedProject(projectId);
    if (cachedProject) {
      warnProjectRecovery(`Project ${projectId} delete failed remotely. Removed local cached copy instead.`, error);
      return cachedProject;
    }

    throw error;
  }
}

export function isProjectsApiUnavailableError(error: unknown) {
  return error instanceof ProjectApiError && error.status === 404 && error.message === "Projects API unavailable.";
}

export function isSpecificProjectNotFoundError(error: unknown) {
  return error instanceof ProjectApiError && error.status === 404 && error.message === "Project not found.";
}
