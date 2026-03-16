import type { CameraState, Point, Room } from "@/lib/editor/types";
import type { EditorDocumentState } from "@/lib/editor/history";
import { normalizePersistedHistorySnapshot } from "@/lib/editor/persistedHistory";
import {
  cloneEditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  normalizeEditorSettings,
  type EditorSettings,
} from "@/lib/editor/settings";

// Browser persistence schema for the editor.
// Compatibility rules:
// - v1 payloads restore layout + camera only.
// - v2 payloads restore layout + camera + bounded snapshot history.
// - v3 payloads restore layout + camera + bounded snapshot history + legacy editor settings.
// - v4 payloads restore layout + camera + bounded snapshot history + legacy editor settings.
// - v5 payloads restore layout + camera + bounded snapshot history + current editor settings.
// - Unknown versions or malformed layout payloads are rejected entirely.
// - Malformed history inside an otherwise valid v2/v3/v4/v5 payload is dropped while layout/camera/settings still hydrate.
export const EDITOR_PERSISTENCE_STORAGE_KEY = "spaceforge.editor.state";
export const EDITOR_PERSISTENCE_VERSION = 5;
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
  settings: EditorSettings;
  historyStack: EditorDocumentState[];
  historyIndex: number;
};

export type PersistedEditorHydrationSnapshot = {
  document: EditorDocumentState;
  camera: CameraState | null;
  settings: EditorSettings;
  historyStack: EditorDocumentState[] | null;
  historyIndex: number | null;
};

export type PersistedEditorPayloadV1 = {
  version: 1;
  document: PersistedDocument;
  camera: CameraState;
};

export type PersistedEditorPayloadV2 = {
  version: 2;
  document: PersistedDocument;
  camera: CameraState;
  history: {
    stack: PersistedDocument[];
    index: number;
  };
};

export type PersistedEditorPayloadV3 = {
  version: 3;
  document: PersistedDocument;
  camera: CameraState;
  settings: unknown;
  history: {
    stack: PersistedDocument[];
    index: number;
  };
};

export type PersistedEditorPayloadV4 = {
  version: 4;
  document: PersistedDocument;
  camera: CameraState;
  settings: unknown;
  history: {
    stack: PersistedDocument[];
    index: number;
  };
};

export type PersistedEditorPayloadV5 = {
  version: typeof EDITOR_PERSISTENCE_VERSION;
  document: PersistedDocument;
  camera: CameraState;
  settings: EditorSettings;
  history: {
    stack: PersistedDocument[];
    index: number;
  };
};

type PersistedEditorParsedPayload =
  | {
      status: "ok";
      snapshot: PersistedEditorHydrationSnapshot;
    }
  | {
      status: "invalid-payload";
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

function createHistorylessHydrationSnapshot(
  document: EditorDocumentState,
  camera: CameraState | null
): PersistedEditorHydrationSnapshot {
  return {
    document: cloneDocument(document),
    camera: camera ? cloneCamera(camera) : null,
    settings: cloneEditorSettings(DEFAULT_EDITOR_SETTINGS),
    historyStack: null,
    historyIndex: null,
  };
}

function parsePersistedEditorPayload(raw: string): PersistedEditorParsedPayload {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return {
        status: "invalid-payload",
      };
    }

    if (parsed.version === 1) {
      if (!isPersistedDocument(parsed.document)) {
        return {
          status: "invalid-payload",
        };
      }

      return {
        status: "ok",
        snapshot: createHistorylessHydrationSnapshot(
          parsed.document,
          isCameraState(parsed.camera) ? parsed.camera : null
        ),
      };
    }

    if (
      (parsed.version !== 2 &&
        parsed.version !== 3 &&
        parsed.version !== 4 &&
        parsed.version !== EDITOR_PERSISTENCE_VERSION) ||
      !isPersistedDocument(parsed.document)
    ) {
      return {
        status: "invalid-payload",
      };
    }

    const normalizedHistory = isPersistedHistory(parsed.history)
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
      status: "ok",
      snapshot: {
        document: cloneDocument(parsed.document),
        camera: isCameraState(parsed.camera) ? cloneCamera(parsed.camera) : null,
        settings: cloneEditorSettings(
          parsed.version === 2
            ? DEFAULT_EDITOR_SETTINGS
            : normalizeEditorSettings(parsed.settings) ?? DEFAULT_EDITOR_SETTINGS
        ),
        historyStack: normalizedHistory?.historyStack ?? null,
        historyIndex: normalizedHistory?.historyIndex ?? null,
      },
    };
  } catch {
    return {
      status: "invalid-payload",
    };
  }
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
  const payload: PersistedEditorPayloadV5 = {
    version: EDITOR_PERSISTENCE_VERSION,
    document: cloneDocument(snapshot.document),
    camera: cloneCamera(snapshot.camera),
    settings: cloneEditorSettings(snapshot.settings),
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
    settings: hydrationSnapshot.settings,
    historyStack: hydrationSnapshot.historyStack,
    historyIndex: hydrationSnapshot.historyIndex,
  };
}

export function deserializeEditorSnapshotForHydration(
  raw: string
): PersistedEditorHydrationSnapshot | null {
  const parsedPayload = parsePersistedEditorPayload(raw);
  if (parsedPayload.status !== "ok") return null;
  return parsedPayload.snapshot;
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

// Narrow debug/development escape hatch for clearing only editor persistence.
export function resetPersistedEditorState(storage: Storage | null = getBrowserStorage()): boolean {
  return clearEditorSnapshot(storage);
}
