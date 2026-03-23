const ANONYMOUS_CLIENT_TOKEN_STORAGE_KEY = "spaceforge.client-token";
const ACTIVE_PROJECT_ID_STORAGE_KEY = "spaceforge.active-project-id";

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function createClientToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function getOrCreateAnonymousClientToken() {
  const storage = getBrowserStorage();
  if (!storage) return createClientToken();

  const existing = getAnonymousClientToken();
  if (existing) return existing;

  const nextToken = createClientToken();
  storage.setItem(ANONYMOUS_CLIENT_TOKEN_STORAGE_KEY, nextToken);
  return nextToken;
}

export function getAnonymousClientToken() {
  const storage = getBrowserStorage();
  if (!storage) return null;

  const existing = storage.getItem(ANONYMOUS_CLIENT_TOKEN_STORAGE_KEY)?.trim() ?? "";
  return existing || null;
}

export function loadActiveProjectId() {
  const storage = getBrowserStorage();
  if (!storage) return null;

  return storage.getItem(ACTIVE_PROJECT_ID_STORAGE_KEY);
}

export function saveActiveProjectId(projectId: string) {
  const storage = getBrowserStorage();
  if (!storage) return;
  storage.setItem(ACTIVE_PROJECT_ID_STORAGE_KEY, projectId);
}

export function clearActiveProjectId() {
  const storage = getBrowserStorage();
  if (!storage) return;
  storage.removeItem(ACTIVE_PROJECT_ID_STORAGE_KEY);
}

export function clearActiveProjectIdIfMatches(projectId: string) {
  const storage = getBrowserStorage();
  if (!storage) return;

  if (storage.getItem(ACTIVE_PROJECT_ID_STORAGE_KEY) === projectId) {
    storage.removeItem(ACTIVE_PROJECT_ID_STORAGE_KEY);
  }
}
