const ANONYMOUS_CLIENT_TOKEN_STORAGE_KEY = "spaceforge.client-token";
const ANONYMOUS_CLIENT_TOKEN_BACKUP_STORAGE_KEY = "spaceforge.client-token.backup";
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

function warnClientIdentity(message: string, details?: unknown) {
  console.warn(`[spaceforge] ${message}`, details);
}

function isValidClientToken(value: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function persistClientToken(storage: Storage, clientToken: string) {
  try {
    storage.setItem(ANONYMOUS_CLIENT_TOKEN_STORAGE_KEY, clientToken);
    storage.setItem(ANONYMOUS_CLIENT_TOKEN_BACKUP_STORAGE_KEY, clientToken);
  } catch (error) {
    warnClientIdentity("Failed to persist anonymous client token to localStorage.", error);
  }
}

export function getOrCreateAnonymousClientToken() {
  const storage = getBrowserStorage();
  if (!storage) return createClientToken();

  const existing = getAnonymousClientToken();
  if (existing) return existing;

  const nextToken = createClientToken();
  persistClientToken(storage, nextToken);
  return nextToken;
}

export function getAnonymousClientToken() {
  const storage = getBrowserStorage();
  if (!storage) return null;

  const primaryToken = storage.getItem(ANONYMOUS_CLIENT_TOKEN_STORAGE_KEY)?.trim() ?? "";
  if (isValidClientToken(primaryToken)) {
    const backupToken = storage.getItem(ANONYMOUS_CLIENT_TOKEN_BACKUP_STORAGE_KEY)?.trim() ?? "";
    if (backupToken !== primaryToken) {
      persistClientToken(storage, primaryToken);
    }
    return primaryToken;
  }

  const backupToken = storage.getItem(ANONYMOUS_CLIENT_TOKEN_BACKUP_STORAGE_KEY)?.trim() ?? "";
  if (isValidClientToken(backupToken)) {
    warnClientIdentity("Recovered anonymous client token from backup storage.");
    persistClientToken(storage, backupToken);
    return backupToken;
  }

  return null;
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
