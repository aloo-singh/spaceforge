"use client";

import { cloneProjectDocument, isProjectDocument, isProjectThumbnailDataUrl, resolveProjectMaxFloors, type ProjectListItem, type ProjectRecord } from "@/lib/projects/types";
import { sortProjectsByUpdatedAt } from "@/lib/projects/listState";

const PROJECT_CACHE_STORAGE_KEY = "spaceforge.projects.cache.v1";
const PROJECT_CACHE_VERSION = 1;

type CachedProjectEntry = {
  clientToken: string;
  project: ProjectRecord;
};

type CachedProjectsPayload = {
  version: typeof PROJECT_CACHE_VERSION;
  projects: CachedProjectEntry[];
};

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function warnProjectCache(message: string, details?: unknown) {
  console.warn(`[spaceforge] ${message}`, details);
}

function isValidProjectListDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(new Date(value).getTime());
}

function normalizeCachedProjectRecord(value: unknown): ProjectRecord | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : null;
  const userId = typeof value.userId === "string" ? value.userId : null;
  const name = typeof value.name === "string" ? value.name : null;
  const thumbnailDataUrl = isProjectThumbnailDataUrl(value.thumbnailDataUrl) ? value.thumbnailDataUrl : null;
  const createdAt = isValidProjectListDate(value.createdAt) ? value.createdAt : null;
  const updatedAt = isValidProjectListDate(value.updatedAt) ? value.updatedAt : null;

  if (!id || !userId || !name) return null;
  if (!isProjectDocument(value.document)) return null;
  if (value.thumbnailDataUrl !== undefined && !isProjectThumbnailDataUrl(value.thumbnailDataUrl)) return null;
  if (!createdAt || !updatedAt) return null;

  return {
    id,
    userId,
    name,
    document: cloneProjectDocument(value.document),
    thumbnailDataUrl,
    maxFloors: resolveProjectMaxFloors(value.maxFloors),
    createdAt,
    updatedAt,
  };
}

function parseCachedProjectsPayload(raw: string): CachedProjectsPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed) || parsed.version !== PROJECT_CACHE_VERSION || !Array.isArray(parsed.projects)) {
      warnProjectCache("Ignoring invalid local project cache payload.");
      return null;
    }

    const projects: CachedProjectEntry[] = [];
    for (const entry of parsed.projects) {
      if (!isObject(entry) || typeof entry.clientToken !== "string") {
        warnProjectCache("Dropping malformed cached project entry.", entry);
        continue;
      }

      const project = normalizeCachedProjectRecord(entry.project);
      if (!project) {
        warnProjectCache("Dropping cached project with invalid document or metadata.", entry.project);
        continue;
      }

      projects.push({
        clientToken: entry.clientToken,
        project,
      });
    }

    return {
      version: PROJECT_CACHE_VERSION,
      projects,
    };
  } catch (error) {
    warnProjectCache("Failed to parse local project cache. Clearing corrupt data.", error);
    return null;
  }
}

function loadCachedProjectsPayload(storage: Storage | null = getBrowserStorage()): CachedProjectsPayload {
  if (!storage) {
    return {
      version: PROJECT_CACHE_VERSION,
      projects: [],
    };
  }

  const raw = storage.getItem(PROJECT_CACHE_STORAGE_KEY);
  if (!raw) {
    return {
      version: PROJECT_CACHE_VERSION,
      projects: [],
    };
  }

  const payload = parseCachedProjectsPayload(raw);
  if (payload) return payload;

  try {
    storage.removeItem(PROJECT_CACHE_STORAGE_KEY);
  } catch (error) {
    warnProjectCache("Failed to clear corrupt local project cache.", error);
  }

  return {
    version: PROJECT_CACHE_VERSION,
    projects: [],
  };
}

function saveCachedProjectsPayload(
  payload: CachedProjectsPayload,
  storage: Storage | null = getBrowserStorage()
) {
  if (!storage) return false;

  try {
    storage.setItem(PROJECT_CACHE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    warnProjectCache("Failed to write local project cache.", error);
    return false;
  }
}

function toProjectListItem(project: ProjectRecord): ProjectListItem {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    thumbnailDataUrl: project.thumbnailDataUrl,
    maxFloors: project.maxFloors,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function sortCachedEntries(entries: CachedProjectEntry[]) {
  return sortProjectsByUpdatedAt(entries.map((entry) => entry.project)).map((project) =>
    entries.find((entry) => entry.project.id === project.id)!
  );
}

export function loadCachedProject(projectId: string, storage: Storage | null = getBrowserStorage()): ProjectRecord | null {
  const payload = loadCachedProjectsPayload(storage);
  const match = payload.projects.find((entry) => entry.project.id === projectId);
  return match ? { ...match.project, document: cloneProjectDocument(match.project.document) } : null;
}

export function loadCachedProjectsForClientToken(
  clientToken: string,
  storage: Storage | null = getBrowserStorage()
): ProjectRecord[] {
  const payload = loadCachedProjectsPayload(storage);
  const exactMatches = payload.projects.filter((entry) => entry.clientToken === clientToken);
  if (exactMatches.length > 0) {
    return sortCachedEntries(exactMatches).map((entry) => ({
      ...entry.project,
      document: cloneProjectDocument(entry.project.document),
    }));
  }

  if (payload.projects.length > 0) {
    warnProjectCache(
      "Primary client token has no cached projects. Falling back to locally recovered projects from a previous token."
    );
  }

  return sortCachedEntries(payload.projects).map((entry) => ({
    ...entry.project,
    document: cloneProjectDocument(entry.project.document),
  }));
}

export function loadCachedProjectListForClientToken(
  clientToken: string,
  storage: Storage | null = getBrowserStorage()
): ProjectListItem[] {
  return loadCachedProjectsForClientToken(clientToken, storage).map(toProjectListItem);
}

export function upsertCachedProject(
  clientToken: string,
  project: ProjectRecord,
  storage: Storage | null = getBrowserStorage()
): ProjectRecord {
  const payload = loadCachedProjectsPayload(storage);
  const normalizedProject: ProjectRecord = {
    ...project,
    document: cloneProjectDocument(project.document),
  };

  const nextEntries = payload.projects.filter((entry) => entry.project.id !== normalizedProject.id);
  nextEntries.push({
    clientToken,
    project: normalizedProject,
  });
  saveCachedProjectsPayload(
    {
      version: PROJECT_CACHE_VERSION,
      projects: sortCachedEntries(nextEntries),
    },
    storage
  );

  return {
    ...normalizedProject,
    document: cloneProjectDocument(normalizedProject.document),
  };
}

export function removeCachedProject(projectId: string, storage: Storage | null = getBrowserStorage()) {
  const payload = loadCachedProjectsPayload(storage);
  const existingEntry = payload.projects.find((entry) => entry.project.id === projectId) ?? null;
  if (!existingEntry) return null;

  saveCachedProjectsPayload(
    {
      version: PROJECT_CACHE_VERSION,
      projects: payload.projects.filter((entry) => entry.project.id !== projectId),
    },
    storage
  );

  return {
    ...existingEntry.project,
    document: cloneProjectDocument(existingEntry.project.document),
  };
}
