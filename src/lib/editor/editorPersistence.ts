import type { CameraState, Point, Room } from "@/lib/editor/types";
import type { EditorDocumentState } from "@/lib/editor/history";
import { normalizePersistedHistorySnapshot } from "@/lib/editor/persistedHistory";

export const EDITOR_PERSISTENCE_STORAGE_KEY = "spaceforge.editor.state";
export const EDITOR_PERSISTENCE_VERSION = 2;
export const PERSISTED_HISTORY_STATE_LIMIT = 50;

type PersistedPoint = Point;

type PersistedRoom = {
  id: string;
  name: string;
  points: PersistedPoint[];
};

type PersistedDocument = {
  rooms: PersistedRoom[];
};

export type PersistedEditorSnapshot = {
  document: EditorDocumentState;
  camera: CameraState;
  historyStack: EditorDocumentState[];
  historyIndex: number;
};

export type PersistedEditorHydrationSnapshot = {
  document: EditorDocumentState;
  camera: CameraState | null;
  historyStack: EditorDocumentState[] | null;
  historyIndex: number | null;
};

export type PersistedEditorPayloadV1 = {
  version: 1;
  document: PersistedDocument;
  camera: CameraState;
};

export type PersistedEditorPayloadV2 = {
  version: typeof EDITOR_PERSISTENCE_VERSION;
  document: PersistedDocument;
  camera: CameraState;
  history: {
    stack: PersistedDocument[];
    index: number;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPoint(value: unknown): value is Point {
  if (!isObject(value)) return false;
  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isRoom(value: unknown): value is PersistedRoom {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.name !== "string") return false;
  if (!Array.isArray(value.points)) return false;
  if (value.points.length < 3) return false;

  return value.points.every((point) => isPoint(point));
}

function isCameraState(value: unknown): value is CameraState {
  if (!isObject(value)) return false;

  return (
    isFiniteNumber(value.xMm) &&
    isFiniteNumber(value.yMm) &&
    isFiniteNumber(value.pixelsPerMm) &&
    value.pixelsPerMm > 0
  );
}

function isPersistedDocument(value: unknown): value is PersistedDocument {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.rooms)) return false;
  return value.rooms.every((room) => isRoom(room));
}

function isPersistedHistory(
  value: unknown
): value is PersistedEditorPayloadV2["history"] {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.stack)) return false;
  const historyIndex = value.index;
  if (typeof historyIndex !== "number" || !Number.isInteger(historyIndex)) return false;
  if (value.stack.length === 0) return false;
  if (value.stack.length > PERSISTED_HISTORY_STATE_LIMIT) return false;
  if (historyIndex < 0 || historyIndex >= value.stack.length) return false;
  return value.stack.every((snapshot) => isPersistedDocument(snapshot));
}

function clonePoint(point: Point): Point {
  return {
    x: point.x,
    y: point.y,
  };
}

function cloneRoom(room: Room): Room {
  return {
    id: room.id,
    name: room.name,
    points: room.points.map(clonePoint),
  };
}

function cloneDocument(document: EditorDocumentState): EditorDocumentState {
  return {
    rooms: document.rooms.map(cloneRoom),
  };
}

function cloneCamera(camera: CameraState): CameraState {
  return {
    xMm: camera.xMm,
    yMm: camera.yMm,
    pixelsPerMm: camera.pixelsPerMm,
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function serializeEditorSnapshot(snapshot: PersistedEditorSnapshot): string {
  const normalizedHistory = normalizePersistedHistorySnapshot(
    {
      historyStack: snapshot.historyStack,
      historyIndex: snapshot.historyIndex,
    },
    PERSISTED_HISTORY_STATE_LIMIT,
    snapshot.document
  );
  const payload: PersistedEditorPayloadV2 = {
    version: EDITOR_PERSISTENCE_VERSION,
    document: cloneDocument(snapshot.document),
    camera: cloneCamera(snapshot.camera),
    history: {
      stack: (normalizedHistory?.historyStack ?? [snapshot.document]).map((document) => cloneDocument(document)),
      index: normalizedHistory?.historyIndex ?? 0,
    },
  };

  return JSON.stringify(payload);
}

export function deserializeEditorSnapshot(raw: string): PersistedEditorSnapshot | null {
  const hydrationSnapshot = deserializeEditorSnapshotForHydration(raw);
  if (
    !hydrationSnapshot ||
    !hydrationSnapshot.camera ||
    !hydrationSnapshot.historyStack ||
    hydrationSnapshot.historyIndex === null
  ) {
    return null;
  }

  return {
    document: hydrationSnapshot.document,
    camera: hydrationSnapshot.camera,
    historyStack: hydrationSnapshot.historyStack,
    historyIndex: hydrationSnapshot.historyIndex,
  };
}

export function deserializeEditorSnapshotForHydration(
  raw: string
): PersistedEditorHydrationSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;
    if (parsed.version === 1) {
      if (!isPersistedDocument(parsed.document)) return null;

      return {
        document: cloneDocument(parsed.document),
        camera: isCameraState(parsed.camera) ? cloneCamera(parsed.camera) : null,
        historyStack: null,
        historyIndex: null,
      };
    }
    if (parsed.version !== EDITOR_PERSISTENCE_VERSION) return null;
    if (!isPersistedDocument(parsed.document)) return null;

    const history = isPersistedHistory(parsed.history)
      ? normalizePersistedHistorySnapshot(
          {
            historyStack: parsed.history.stack.map((document) => cloneDocument(document)),
            historyIndex: parsed.history.index,
          },
          PERSISTED_HISTORY_STATE_LIMIT,
          parsed.document
        )
      : null;

    return {
      document: cloneDocument(parsed.document),
      camera: isCameraState(parsed.camera) ? cloneCamera(parsed.camera) : null,
      historyStack: history?.historyStack ?? null,
      historyIndex: history?.historyIndex ?? null,
    };
  } catch {
    return null;
  }
}

export function saveEditorSnapshot(
  snapshot: PersistedEditorSnapshot,
  storage: Storage | null = getBrowserStorage()
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(EDITOR_PERSISTENCE_STORAGE_KEY, serializeEditorSnapshot(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadEditorSnapshot(
  storage: Storage | null = getBrowserStorage()
): PersistedEditorSnapshot | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(EDITOR_PERSISTENCE_STORAGE_KEY);
    if (!raw) return null;
    return deserializeEditorSnapshot(raw);
  } catch {
    return null;
  }
}

export function loadEditorSnapshotForHydration(
  storage: Storage | null = getBrowserStorage()
): PersistedEditorHydrationSnapshot | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(EDITOR_PERSISTENCE_STORAGE_KEY);
    if (!raw) return null;
    return deserializeEditorSnapshotForHydration(raw);
  } catch {
    return null;
  }
}

export function clearEditorSnapshot(storage: Storage | null = getBrowserStorage()): boolean {
  if (!storage) return false;

  try {
    storage.removeItem(EDITOR_PERSISTENCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
