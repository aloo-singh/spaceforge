import { cloneProjectDocument, type ProjectListItem, type ProjectRecord } from "@/lib/projects/types";
import { createProject, fetchProjectSafely, fetchProjects } from "@/lib/projects/clientApi";
import {
  clearActiveProjectId,
  loadActiveProjectId,
  saveActiveProjectId,
} from "@/lib/projects/clientIdentity";
import type { EditorDocumentState } from "@/lib/editor/history";
import { getDefaultProjectName } from "@/lib/projects/defaults";

const FIRST_PROJECT_BOOTSTRAP_STORAGE_KEY = "spaceforge.first-project-bootstrap";
const FIRST_PROJECT_BOOTSTRAP_STALE_MS = 15_000;
const FIRST_PROJECT_BOOTSTRAP_TIMEOUT_MS = 12_000;
const FIRST_PROJECT_BOOTSTRAP_POLL_MS = 250;

const inFlightFirstProjectBootstraps = new Map<string, Promise<ProjectRecord>>();

type PendingFirstProjectBootstrapState = {
  clientToken: string;
  startedAt: number;
};

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function readPendingFirstProjectBootstrapState(): PendingFirstProjectBootstrapState | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(FIRST_PROJECT_BOOTSTRAP_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<PendingFirstProjectBootstrapState>;
    if (
      typeof parsedValue.clientToken !== "string" ||
      typeof parsedValue.startedAt !== "number" ||
      !Number.isFinite(parsedValue.startedAt)
    ) {
      storage.removeItem(FIRST_PROJECT_BOOTSTRAP_STORAGE_KEY);
      return null;
    }

    return {
      clientToken: parsedValue.clientToken,
      startedAt: parsedValue.startedAt,
    };
  } catch {
    storage.removeItem(FIRST_PROJECT_BOOTSTRAP_STORAGE_KEY);
    return null;
  }
}

function clearPendingFirstProjectBootstrapState(clientToken?: string) {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  const pendingState = readPendingFirstProjectBootstrapState();
  if (!pendingState) {
    return;
  }

  if (clientToken && pendingState.clientToken !== clientToken) {
    return;
  }

  storage.removeItem(FIRST_PROJECT_BOOTSTRAP_STORAGE_KEY);
}

function markPendingFirstProjectBootstrap(clientToken: string) {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    FIRST_PROJECT_BOOTSTRAP_STORAGE_KEY,
    JSON.stringify({
      clientToken,
      startedAt: Date.now(),
    } satisfies PendingFirstProjectBootstrapState)
  );
}

function hasFreshPendingFirstProjectBootstrap(clientToken: string) {
  const pendingState = readPendingFirstProjectBootstrapState();
  if (!pendingState) {
    return false;
  }

  if (pendingState.clientToken !== clientToken) {
    clearPendingFirstProjectBootstrapState();
    return false;
  }

  if (Date.now() - pendingState.startedAt > FIRST_PROJECT_BOOTSTRAP_STALE_MS) {
    clearPendingFirstProjectBootstrapState(clientToken);
    return false;
  }

  return true;
}

function delay(timeoutMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
}

async function fetchPreferredProject(
  clientToken: string,
  projects: ProjectListItem[]
): Promise<ProjectRecord | null> {
  const preferredProjectId = loadActiveProjectId();
  const preferredProject = projects.find((project) => project.id === preferredProjectId) ?? projects[0] ?? null;

  if (!preferredProject) {
    return null;
  }

  const resolvedProject = await fetchProjectSafely(clientToken, preferredProject.id);
  if (!resolvedProject) {
    if (preferredProjectId && preferredProject.id === preferredProjectId) {
      clearActiveProjectId();
    }

    return null;
  }

  saveActiveProjectId(resolvedProject.id);
  return resolvedProject;
}

async function findExistingProjectForClientToken(clientToken: string): Promise<ProjectRecord | null> {
  const activeProjectId = loadActiveProjectId();
  if (activeProjectId) {
    const activeProject = await fetchProjectSafely(clientToken, activeProjectId);
    if (activeProject) {
      saveActiveProjectId(activeProject.id);
      return activeProject;
    }

    clearActiveProjectId();
  }

  const projects = await fetchProjects(clientToken);
  return fetchPreferredProject(clientToken, projects);
}

async function waitForPendingFirstProject(clientToken: string): Promise<ProjectRecord | null> {
  const timeoutAt = Date.now() + FIRST_PROJECT_BOOTSTRAP_TIMEOUT_MS;

  while (Date.now() < timeoutAt) {
    const resolvedProject = await findExistingProjectForClientToken(clientToken);
    if (resolvedProject) {
      return resolvedProject;
    }

    if (!hasFreshPendingFirstProjectBootstrap(clientToken)) {
      return null;
    }

    await delay(FIRST_PROJECT_BOOTSTRAP_POLL_MS);
  }

  clearPendingFirstProjectBootstrapState(clientToken);
  return null;
}

export async function ensureFirstProject(
  clientToken: string,
  initialDocument: EditorDocumentState
): Promise<ProjectRecord> {
  const existingBootstrap = inFlightFirstProjectBootstraps.get(clientToken);
  if (existingBootstrap) {
    return existingBootstrap;
  }

  const bootstrapPromise = (async () => {
    const existingProject = await findExistingProjectForClientToken(clientToken);
    if (existingProject) {
      return existingProject;
    }

    if (hasFreshPendingFirstProjectBootstrap(clientToken)) {
      const pendingProject = await waitForPendingFirstProject(clientToken);
      if (pendingProject) {
        return pendingProject;
      }
    }

    markPendingFirstProjectBootstrap(clientToken);

    try {
      const projectCreatedByCompetitor = await findExistingProjectForClientToken(clientToken);
      if (projectCreatedByCompetitor) {
        return projectCreatedByCompetitor;
      }

      try {
        const createdProject = await createProject(clientToken, {
          name: getDefaultProjectName({ existingProjectCount: 0 }),
          document: cloneProjectDocument(initialDocument),
        });
        saveActiveProjectId(createdProject.id);
        return createdProject;
      } catch (error) {
        const recoveredProject = await findExistingProjectForClientToken(clientToken);
        if (recoveredProject) {
          return recoveredProject;
        }

        throw error;
      }
    } finally {
      clearPendingFirstProjectBootstrapState(clientToken);
    }
  })().finally(() => {
    inFlightFirstProjectBootstraps.delete(clientToken);
  });

  inFlightFirstProjectBootstraps.set(clientToken, bootstrapPromise);
  return bootstrapPromise;
}
