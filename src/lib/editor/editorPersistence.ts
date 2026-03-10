import type { CameraState, Point, Room } from "@/lib/editor/types";
import type { EditorDocumentState } from "@/lib/editor/history";

export const EDITOR_PERSISTENCE_STORAGE_KEY = "spaceforge.editor.state";
export const EDITOR_PERSISTENCE_VERSION = 1;

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
};

export type PersistedEditorPayloadV1 = {
  version: typeof EDITOR_PERSISTENCE_VERSION;
  document: PersistedDocument;
  camera: CameraState;
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

function isPersistedEditorPayloadV1(value: unknown): value is PersistedEditorPayloadV1 {
  if (!isObject(value)) return false;
  if (value.version !== EDITOR_PERSISTENCE_VERSION) return false;
  if (!isObject(value.document)) return false;
  if (!Array.isArray(value.document.rooms)) return false;
  if (!value.document.rooms.every((room) => isRoom(room))) return false;

  return isCameraState(value.camera);
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
  const payload: PersistedEditorPayloadV1 = {
    version: EDITOR_PERSISTENCE_VERSION,
    document: cloneDocument(snapshot.document),
    camera: cloneCamera(snapshot.camera),
  };

  return JSON.stringify(payload);
}

export function deserializeEditorSnapshot(raw: string): PersistedEditorSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedEditorPayloadV1(parsed)) return null;

    return {
      document: cloneDocument(parsed.document),
      camera: cloneCamera(parsed.camera),
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

export function clearEditorSnapshot(storage: Storage | null = getBrowserStorage()): boolean {
  if (!storage) return false;

  try {
    storage.removeItem(EDITOR_PERSISTENCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
