"use client";

import type { ProjectCatalogEntry } from "@/lib/projects/types";

const PROJECT_CATALOG_DB_NAME = "spaceforge.catalog.v1";
const PROJECT_CATALOG_STORE_NAME = "projects";
const PROJECT_CATALOG_VERSION = 1;
const PROJECT_CATALOG_LOCAL_STORAGE_KEY = "spaceforge.catalog.v1";

type CatalogStoragePayload = {
  version: typeof PROJECT_CATALOG_VERSION;
  entries: ProjectCatalogEntry[];
};

function warnCatalog(message: string, details?: unknown) {
  console.warn(`[spaceforge] ${message}`, details);
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !isNaN(new Date(value).getTime());
}

function isValidThumbnailDataUrl(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.startsWith("data:image/"));
}

function normalizeCatalogEntry(value: unknown): ProjectCatalogEntry | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (!isValidDateString(value.lastModified)) return null;
  if (!isValidThumbnailDataUrl(value.thumbnailDataUrl)) return null;
  if (typeof value.documentVersion !== "number" || !Number.isInteger(value.documentVersion)) return null;
  if (value.recoveryBlobId !== null && typeof value.recoveryBlobId !== "string") return null;

  return {
    id: value.id,
    name: value.name,
    lastModified: value.lastModified,
    thumbnailDataUrl: value.thumbnailDataUrl,
    documentVersion: value.documentVersion,
    recoveryBlobId: value.recoveryBlobId,
  };
}

function parseCatalogPayload(raw: string): CatalogStoragePayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed) || parsed.version !== PROJECT_CATALOG_VERSION || !Array.isArray(parsed.entries)) {
      warnCatalog("Ignoring invalid catalog payload.");
      return null;
    }

    const entries: ProjectCatalogEntry[] = [];
    for (const entry of parsed.entries) {
      const normalized = normalizeCatalogEntry(entry);
      if (!normalized) {
        warnCatalog("Dropping invalid catalog entry.", entry);
        continue;
      }
      entries.push(normalized);
    }

    return {
      version: PROJECT_CATALOG_VERSION,
      entries,
    };
  } catch (error) {
    warnCatalog("Failed to parse catalog payload.", error);
    return null;
  }
}

async function openCatalogDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    warnCatalog("IndexedDB not available, falling back to localStorage.");
    return null;
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(PROJECT_CATALOG_DB_NAME, PROJECT_CATALOG_VERSION);

    request.onerror = () => {
      warnCatalog("Failed to open catalog database.", request.error);
      resolve(null);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROJECT_CATALOG_STORE_NAME)) {
        db.createObjectStore(PROJECT_CATALOG_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function loadCatalogFromIndexedDB(): Promise<ProjectCatalogEntry[]> {
  const db = await openCatalogDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    const transaction = db.transaction([PROJECT_CATALOG_STORE_NAME], "readonly");
    const store = transaction.objectStore(PROJECT_CATALOG_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
      warnCatalog("Failed to load catalog from IndexedDB.", request.error);
      resolve([]);
    };

    request.onsuccess = () => {
      const entries = request.result as ProjectCatalogEntry[];
      resolve(entries);
    };
  });
}

async function saveCatalogToIndexedDB(entries: ProjectCatalogEntry[]): Promise<void> {
  const db = await openCatalogDatabase();
  if (!db) return;

  const transaction = db.transaction([PROJECT_CATALOG_STORE_NAME], "readwrite");
  const store = transaction.objectStore(PROJECT_CATALOG_STORE_NAME);

  // Clear existing entries
  store.clear();

  // Add new entries
  for (const entry of entries) {
    store.add(entry);
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      warnCatalog("Failed to save catalog to IndexedDB.", transaction.error);
      reject(transaction.error);
    };
  });
}

function loadCatalogFromLocalStorage(): ProjectCatalogEntry[] {
  const storage = getBrowserStorage();
  if (!storage) return [];

  const raw = storage.getItem(PROJECT_CATALOG_LOCAL_STORAGE_KEY);
  if (!raw) return [];

  const payload = parseCatalogPayload(raw);
  return payload ? payload.entries : [];
}

function saveCatalogToLocalStorage(entries: ProjectCatalogEntry[]): void {
  const storage = getBrowserStorage();
  if (!storage) return;

  const payload: CatalogStoragePayload = {
    version: PROJECT_CATALOG_VERSION,
    entries,
  };

  try {
    storage.setItem(PROJECT_CATALOG_LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    warnCatalog("Failed to save catalog to localStorage.", error);
  }
}

export async function loadProjectCatalog(): Promise<ProjectCatalogEntry[]> {
  // Try IndexedDB first
  let entries = await loadCatalogFromIndexedDB();
  if (entries.length > 0) {
    // Sync to localStorage as mirror
    saveCatalogToLocalStorage(entries);
    return entries;
  }

  // Fallback to localStorage
  entries = loadCatalogFromLocalStorage();
  if (entries.length > 0) {
    // Migrate to IndexedDB
    await saveCatalogToIndexedDB(entries);
  }

  return entries;
}

export async function saveProjectCatalog(entries: ProjectCatalogEntry[]): Promise<void> {
  // Save to IndexedDB primary
  await saveCatalogToIndexedDB(entries);

  // Mirror to localStorage
  saveCatalogToLocalStorage(entries);
}

export async function addOrUpdateCatalogEntry(entry: ProjectCatalogEntry): Promise<void> {
  const entries = await loadProjectCatalog();
  const existingIndex = entries.findIndex(e => e.id === entry.id);

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  await saveProjectCatalog(entries);
}