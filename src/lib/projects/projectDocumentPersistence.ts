"use client";

import type { EditorDocumentState } from "@/lib/editor/history";
import type { ProjectCatalogEntry } from "@/lib/projects/types";
import { addOrUpdateCatalogEntry } from "@/lib/projects/catalog";

/**
 * Project Document Persistence Layer
 *
 * SEPARATION OF CONCERNS:
 * ======================
 * PERSISTENT DATA (saved):
 * - document: EditorDocumentState (rooms, floors, openings, interior assets, export config, north bearing, canvas rotation)
 * - historyStack: Array of document snapshots for undo/redo
 * - historyIndex: Current position in the undo/redo stack
 * - lastModified: Timestamp for recovery decision-making
 * - id: Project identifier
 *
 * TRANSIENT STATE (NOT saved, reset on recovery):
 * - camera: { xMm, yMm, pixelsPerMm, rotationDegrees } — viewport position/zoom, resets on load
 * - selectedRoomId, selectedWall, selectedOpening, selectedInteriorAsset — UI selection, clears on load
 * - selection array — multi-select state, clears on load
 * - roomDraft — work-in-progress room being drawn, cleared on load
 * - renameSession, interiorAssetRenameSession — modal/input sessions, cleared on load
 * - clipboard, pendingProjectOpenCameraFit — temporary UI state, cleared on load
 * - editor settings — preserved separately via editorPersistence.ts (not project-specific)
 *
 * This separation ensures:
 * 1. Users never lose their spatial design (document)
 * 2. Undo/redo history is preserved across sessions
 * 3. UI state resets to sensible defaults on recovery (safe, no orphaned selections)
 * 4. Recovery is predictable and doesn't leave the editor in an invalid state
 */

const PROJECT_DOCUMENTS_DB_NAME = "spaceforge.projects.v1";
const PROJECT_DOCUMENTS_STORE_NAME = "documents";
const PROJECT_DOCUMENTS_VERSION = 1;
const PROJECT_DOCUMENTS_LOCAL_STORAGE_KEY = "spaceforge.projects.documents.v1";
const PROJECT_HISTORY_STATE_LIMIT = 100;

/**
 * Persistent project document — only includes structural/spatial data + history.
 * Camera, selection, and other transient UI state are explicitly NOT included.
 */
export type PersistedProjectDocument = {
  id: string;
  document: EditorDocumentState; // Room geometry, floors, openings, etc. — the actual design
  lastModified: string; // For recovery timestamp comparison
  historyStack: EditorDocumentState[]; // Previous document snapshots for undo/redo
  historyIndex: number; // Current position in history stack
};

type ProjectDocumentsStoragePayload = {
  version: typeof PROJECT_DOCUMENTS_VERSION;
  projects: PersistedProjectDocument[];
};

function warnProjectPersistence(message: string, details?: unknown) {
  console.warn(`[spaceforge] ${message}`, details);
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProjectDocumentsPayload(raw: string): ProjectDocumentsStoragePayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed) || parsed.version !== PROJECT_DOCUMENTS_VERSION || !Array.isArray(parsed.projects)) {
      warnProjectPersistence("Ignoring invalid project documents payload.");
      return null;
    }
    // Note: Full validation of documents would happen during recovery flow
    return {
      version: PROJECT_DOCUMENTS_VERSION,
      projects: parsed.projects,
    };
  } catch (error) {
    warnProjectPersistence("Failed to parse project documents payload.", error);
    return null;
  }
}

async function openProjectDocumentsDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return null;
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(PROJECT_DOCUMENTS_DB_NAME, PROJECT_DOCUMENTS_VERSION);

    request.onerror = () => {
      warnProjectPersistence("Failed to open project documents database.", request.error);
      resolve(null);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROJECT_DOCUMENTS_STORE_NAME)) {
        db.createObjectStore(PROJECT_DOCUMENTS_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function saveProjectDocumentToIndexedDB(projectDoc: PersistedProjectDocument): Promise<boolean> {
  const db = await openProjectDocumentsDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    const transaction = db.transaction([PROJECT_DOCUMENTS_STORE_NAME], "readwrite");
    const store = transaction.objectStore(PROJECT_DOCUMENTS_STORE_NAME);

    const request = store.put(projectDoc);

    request.onerror = () => {
      warnProjectPersistence("Failed to save project document to IndexedDB.", request.error);
      resolve(false);
    };

    transaction.oncomplete = () => {
      resolve(true);
    };

    transaction.onerror = () => {
      warnProjectPersistence("Failed to save project document transaction.", transaction.error);
      resolve(false);
    };
  });
}

function saveProjectDocumentToLocalStorage(projectDoc: PersistedProjectDocument): boolean {
  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    // Load existing projects payload
    const raw = storage.getItem(PROJECT_DOCUMENTS_LOCAL_STORAGE_KEY);
    let payload: ProjectDocumentsStoragePayload;

    if (raw) {
      const parsed = parseProjectDocumentsPayload(raw);
      payload = parsed ?? { version: PROJECT_DOCUMENTS_VERSION, projects: [] };
    } else {
      payload = { version: PROJECT_DOCUMENTS_VERSION, projects: [] };
    }

    // Update or add the project
    const existingIndex = payload.projects.findIndex((p) => p.id === projectDoc.id);
    if (existingIndex >= 0) {
      payload.projects[existingIndex] = projectDoc;
    } else {
      payload.projects.push(projectDoc);
    }

    storage.setItem(PROJECT_DOCUMENTS_LOCAL_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    warnProjectPersistence("Failed to save project document to localStorage.", error);
    return false;
  }
}

export async function saveProjectDocument(
  projectId: string,
  projectName: string,
  document: EditorDocumentState,
  thumbnailDataUrl: string | null = null,
  historyStack: EditorDocumentState[] = [],
  historyIndex: number = 0
): Promise<boolean> {
  const now = new Date().toISOString();

  // Cap history to reasonable size
  const cappedHistoryStack = historyStack.slice(-PROJECT_HISTORY_STATE_LIMIT);
  const cappedHistoryIndex = Math.min(historyIndex, cappedHistoryStack.length - 1);

  const projectDoc: PersistedProjectDocument = {
    id: projectId,
    document,
    lastModified: now,
    historyStack: cappedHistoryStack,
    historyIndex: cappedHistoryIndex,
  };

  // Primary: IndexedDB
  const indexedDBSuccess = await saveProjectDocumentToIndexedDB(projectDoc);

  // Fallback: localStorage (always try, even if IndexedDB succeeded)
  const localStorageSuccess = saveProjectDocumentToLocalStorage(projectDoc);

  // Update catalog entry with lastModified and thumbnail
  const catalogEntry: ProjectCatalogEntry = {
    id: projectId,
    name: projectName,
    lastModified: now,
    thumbnailDataUrl,
    documentVersion: 1, // TODO: increment based on actual version in step 4
    recoveryBlobId: null, // TODO: set when implementing blob storage
  };

  try {
    await addOrUpdateCatalogEntry(catalogEntry);
  } catch (error) {
    warnProjectPersistence("Failed to update catalog entry during project save.", error);
    // Don't fail the entire save if catalog update fails
  }

  // Consider save successful if at least one storage layer succeeded
  if (!indexedDBSuccess && !localStorageSuccess) {
    warnProjectPersistence(
      "Failed to save project document to both IndexedDB and localStorage."
    );
    return false;
  }

  // Log if only one layer succeeded
  if (indexedDBSuccess && !localStorageSuccess) {
    warnProjectPersistence("Project saved to IndexedDB but localStorage mirror failed.");
  } else if (!indexedDBSuccess && localStorageSuccess) {
    warnProjectPersistence(
      "Project saved to localStorage. IndexedDB unavailable, using fallback."
    );
  }

  return true;
}

export async function loadProjectDocument(projectId: string): Promise<PersistedProjectDocument | null> {
  const db = await openProjectDocumentsDatabase();
  if (db) {
    try {
      const doc = await new Promise<PersistedProjectDocument | undefined>((resolve) => {
        const transaction = db.transaction([PROJECT_DOCUMENTS_STORE_NAME], "readonly");
        const store = transaction.objectStore(PROJECT_DOCUMENTS_STORE_NAME);
        const request = store.get(projectId);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          warnProjectPersistence("Failed to load project from IndexedDB.", request.error);
          resolve(undefined);
        };
      });

      if (doc) return doc;
    } catch (error) {
      warnProjectPersistence("Error loading project from IndexedDB.", error);
    }
  }

  // Fallback: localStorage
  const storage = getBrowserStorage();
  if (!storage) return null;

  const raw = storage.getItem(PROJECT_DOCUMENTS_LOCAL_STORAGE_KEY);
  if (!raw) return null;

  const payload = parseProjectDocumentsPayload(raw);
  if (!payload) return null;

  return payload.projects.find((p) => p.id === projectId) ?? null;
}

export async function checkForCachedProjectRecovery(
  projectId: string,
  serverLastModified: string
): Promise<{ shouldRecover: boolean; cachedDoc: PersistedProjectDocument | null }> {
  const cachedDoc = await loadProjectDocument(projectId);

  if (!cachedDoc) {
    return { shouldRecover: false, cachedDoc: null };
  }

  // Check if cached version is fresher than server version
  const cachedTime = new Date(cachedDoc.lastModified).getTime();
  const serverTime = new Date(serverLastModified).getTime();

  // Recover if cached is significantly fresher (more than 100ms) or server time is invalid
  if (!Number.isFinite(serverTime) || cachedTime > serverTime + 100) {
    return { shouldRecover: true, cachedDoc };
  }

  return { shouldRecover: false, cachedDoc };
}
