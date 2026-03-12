import { create } from "zustand";
import { GRID_SIZE_MM, INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
import { applyEditorCommand, type EditorCommand } from "@/lib/editor/history";
import {
  panCameraByScreenDelta,
  zoomCameraToScreenPoint,
} from "@/lib/editor/camera";
import {
  getOrthogonalSnappedPoint,
  getRectangleClosingPoint,
  isZeroLengthSegment,
  pointsEqual,
  snapPointToGrid,
} from "@/lib/editor/geometry";
import { loadEditorSnapshotForHydration, saveEditorSnapshot } from "@/lib/editor/editorPersistence";
import type { CameraState, Point, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";

declare global {
  interface Window {
    __spaceforgeEditorAutosaveCleanup__?: () => void;
  }
}

type RoomDraftState = {
  points: Point[];
};

type DocumentState = {
  rooms: Room[];
};

type RenameSessionState = {
  roomId: string;
  initialName: string;
} | null;

type EditorState = {
  document: DocumentState;
  camera: CameraState;
  viewport: ViewportSize;
  roomDraft: RoomDraftState;
  selectedRoomId: string | null;
  shouldFocusSelectedRoomNameInput: boolean;
  renameSession: RenameSessionState;
  history: {
    past: EditorCommand[];
    future: EditorCommand[];
  };
  canUndo: boolean;
  canRedo: boolean;
  setViewport: (width: number, height: number) => void;
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  setCameraCenterMm: (xMm: number, yMm: number) => void;
  placeDraftPointFromCursor: (cursorWorld: Point) => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  clearRoomSelection: () => void;
  consumeSelectedRoomNameInputFocusRequest: () => void;
  startRoomRenameSession: (roomId: string) => void;
  updateRoomRenameDraft: (roomId: string, name: string) => void;
  commitRoomRenameSession: (options?: { deselectIfUnchanged?: boolean }) => void;
  cancelRoomRenameSession: () => void;
  updateRoomName: (roomId: string, name: string) => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  resetCanvas: () => void;
  undo: () => void;
  redo: () => void;
};

const HISTORY_LIMIT = 100;
const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 300;
const DEFAULT_DOCUMENT_STATE: DocumentState = {
  rooms: [],
};
const DEFAULT_CAMERA_STATE: CameraState = {
  xMm: 0,
  yMm: 0,
  pixelsPerMm: INITIAL_PIXELS_PER_MM,
};

function pushToPast(past: EditorCommand[], command: EditorCommand): EditorCommand[] {
  const nextPast = [...past, command];
  if (nextPast.length <= HISTORY_LIMIT) return nextPast;
  return nextPast.slice(nextPast.length - HISTORY_LIMIT);
}

function createRoomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `room-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function updateRoomNameInDocument(document: DocumentState, roomId: string, name: string): DocumentState {
  return {
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            name,
          }
        : room
    ),
  };
}

function updateRoomPointsInDocument(
  document: DocumentState,
  roomId: string,
  nextPoints: Point[]
): DocumentState {
  return {
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            points: nextPoints.map((point) => ({ ...point })),
          }
        : room
    ),
  };
}

function arePointListsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

function areCamerasEqual(a: CameraState, b: CameraState): boolean {
  return a.xMm === b.xMm && a.yMm === b.yMm && a.pixelsPerMm === b.pixelsPerMm;
}

function getSelectionIfRoomExists(roomId: string | null, document: DocumentState): string | null {
  if (!roomId) return null;
  return document.rooms.some((room) => room.id === roomId) ? roomId : null;
}

const hydrationSnapshot = loadEditorSnapshotForHydration();

function createInitialDocumentState(): DocumentState {
  return hydrationSnapshot?.document ?? DEFAULT_DOCUMENT_STATE;
}

function createInitialCameraState(): CameraState {
  return hydrationSnapshot?.camera ?? DEFAULT_CAMERA_STATE;
}

export const useEditorStore = create<EditorState>((set) => ({
  document: createInitialDocumentState(),
  camera: createInitialCameraState(),
  viewport: {
    width: 1,
    height: 1,
  },
  roomDraft: {
    points: [],
  },
  selectedRoomId: null,
  shouldFocusSelectedRoomNameInput: false,
  renameSession: null,
  history: {
    past: [],
    future: [],
  },
  canUndo: false,
  canRedo: false,
  setViewport: (width, height) => set({ viewport: { width, height } }),
  panCameraByPx: (delta) =>
    set((state) => ({
      camera: panCameraByScreenDelta(state.camera, delta),
    })),
  zoomAtScreenPoint: (screenPoint, scaleFactor) =>
    set((state) => ({
      camera: zoomCameraToScreenPoint(
        state.camera,
        state.viewport,
        screenPoint,
        state.camera.pixelsPerMm * scaleFactor
      ),
    })),
  setCameraCenterMm: (xMm, yMm) =>
    set((state) => ({
      camera: {
        ...state.camera,
        xMm,
        yMm,
      },
    })),
  placeDraftPointFromCursor: (cursorWorld) =>
    set((state) => {
      const draftPoints = state.roomDraft.points;

      if (draftPoints.length === 0) {
        return {
          roomDraft: {
            points: [snapPointToGrid(cursorWorld, GRID_SIZE_MM)],
          },
        };
      }

      const lastPoint = draftPoints[draftPoints.length - 1];
      const nextPoint = getOrthogonalSnappedPoint(lastPoint, cursorWorld, GRID_SIZE_MM);

      if (isZeroLengthSegment(lastPoint, nextPoint)) return state;

      if (draftPoints.length === 3) {
        const closingPoint = getRectangleClosingPoint(draftPoints);
        if (!closingPoint || !pointsEqual(nextPoint, closingPoint)) {
          return state;
        }

        const roomPoints = [...draftPoints, closingPoint];
        const room: Room = {
          id: createRoomId(),
          name: `Room ${state.document.rooms.length + 1}`,
          points: roomPoints,
        };
        const command: EditorCommand = {
          type: "complete-room",
          room,
        };
        const nextDocument = applyEditorCommand(state.document, command, "redo");
        return {
          document: nextDocument,
          roomDraft: {
            points: [],
          },
          selectedRoomId: room.id,
          shouldFocusSelectedRoomNameInput: true,
          renameSession: null,
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      if (draftPoints.length === 2) {
        const firstPoint = draftPoints[0];
        if (firstPoint.x === nextPoint.x || firstPoint.y === nextPoint.y) {
          return state;
        }
      }

      return {
        roomDraft: {
          points: [...draftPoints, nextPoint],
        },
      };
    }),
  resetDraft: () =>
    set({
      roomDraft: {
        points: [],
      },
    }),
  selectRoomById: (roomId) =>
    set((state) => {
      if (state.selectedRoomId === roomId) return state;

      return {
        selectedRoomId: roomId,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  clearRoomSelection: () =>
    set({
      selectedRoomId: null,
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
    }),
  consumeSelectedRoomNameInputFocusRequest: () =>
    set((state) => {
      if (!state.shouldFocusSelectedRoomNameInput) return state;
      return {
        shouldFocusSelectedRoomNameInput: false,
      };
    }),
  startRoomRenameSession: (roomId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (state.renameSession?.roomId === roomId) return state;

      return {
        renameSession: {
          roomId,
          initialName: room.name,
        },
      };
    }),
  updateRoomRenameDraft: (roomId, name) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;

      const renameSession =
        state.renameSession?.roomId === roomId
          ? state.renameSession
          : {
              roomId,
              initialName: room.name,
            };

      if (room.name === name && state.renameSession?.roomId === roomId) return state;

      return {
        document: updateRoomNameInDocument(state.document, roomId, name),
        renameSession,
      };
    }),
  commitRoomRenameSession: (options) =>
    set((state) => {
      const deselectIfUnchanged = options?.deselectIfUnchanged ?? true;
      const renameSession = state.renameSession;
      if (!renameSession) {
        if (!state.selectedRoomId) return state;
        if (!deselectIfUnchanged) return state;
        return { selectedRoomId: null };
      }

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      if (!room) {
        return {
          selectedRoomId: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const didNameChange = room.name !== renameSession.initialName;
      if (!didNameChange) {
        if (!deselectIfUnchanged) {
          return {
            renameSession: null,
          };
        }
        return {
          selectedRoomId: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const command: EditorCommand = {
        type: "rename-room",
        roomId: renameSession.roomId,
        previousName: renameSession.initialName,
        nextName: room.name,
      };

      return {
        selectedRoomId: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  cancelRoomRenameSession: () =>
    set((state) => {
      const renameSession = state.renameSession;
      if (!renameSession) {
        if (!state.selectedRoomId) return state;
        return {
          selectedRoomId: null,
          shouldFocusSelectedRoomNameInput: false,
        };
      }

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      const nextDocument =
        room && room.name !== renameSession.initialName
          ? updateRoomNameInDocument(state.document, renameSession.roomId, renameSession.initialName)
          : state.document;

      return {
        document: nextDocument,
        selectedRoomId: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  updateRoomName: (roomId, name) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room || room.name === name) return state;

      const command: EditorCommand = {
        type: "rename-room",
        roomId,
        previousName: room.name,
        nextName: name,
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewRoomResize: (roomId, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(room.points, nextPoints)) return state;

      return {
        document: updateRoomPointsInDocument(state.document, roomId, nextPoints),
      };
    }),
  commitRoomResize: (roomId, previousPoints, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(previousPoints, nextPoints)) return state;

      const command: EditorCommand = {
        type: "resize-room",
        roomId,
        previousPoints: previousPoints.map((point) => ({ ...point })),
        nextPoints: nextPoints.map((point) => ({ ...point })),
      };

      return {
        document: updateRoomPointsInDocument(state.document, roomId, nextPoints),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  resetCanvas: () =>
    set((state) => ({
      document: {
        rooms: [],
      },
      camera: { ...DEFAULT_CAMERA_STATE },
      roomDraft: {
        points: [],
      },
      selectedRoomId: null,
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
      history: {
        past: [],
        future: [],
      },
      canUndo: false,
      canRedo: false,
      viewport: state.viewport,
    })),
  undo: () =>
    set((state) => {
      const command = state.history.past[state.history.past.length - 1];
      if (!command) return state;
      const nextDocument = applyEditorCommand(state.document, command, "undo");
      const nextPast = state.history.past.slice(0, -1);
      const nextFuture = [command, ...state.history.future];

      return {
        document: nextDocument,
        selectedRoomId: getSelectionIfRoomExists(state.selectedRoomId, nextDocument),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: nextPast,
          future: nextFuture,
        },
        canUndo: nextPast.length > 0,
        canRedo: true,
      };
    }),
  redo: () =>
    set((state) => {
      const [command, ...remainingFuture] = state.history.future;
      if (!command) return state;
      const nextDocument = applyEditorCommand(state.document, command, "redo");
      const nextPast = pushToPast(state.history.past, command);

      return {
        document: nextDocument,
        selectedRoomId: getSelectionIfRoomExists(state.selectedRoomId, nextDocument),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: nextPast,
          future: remainingFuture,
        },
        canUndo: true,
        canRedo: remainingFuture.length > 0,
      };
    }),
}));

if (typeof window !== "undefined") {
  window.__spaceforgeEditorAutosaveCleanup__?.();

  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastSavedPersistedSignature = JSON.stringify({
    document: useEditorStore.getState().document,
    camera: useEditorStore.getState().camera,
  });

  const flushAutosave = () => {
    autosaveTimeout = null;
    const state = useEditorStore.getState();
    const nextPersistedSignature = JSON.stringify({
      document: state.document,
      camera: state.camera,
    });
    if (nextPersistedSignature === lastSavedPersistedSignature) return;

    const didSave = saveEditorSnapshot({
      document: state.document,
      camera: state.camera,
    });
    if (didSave) {
      lastSavedPersistedSignature = nextPersistedSignature;
    }
  };

  const flushPendingAutosave = () => {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
      autosaveTimeout = null;
    }
    flushAutosave();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushPendingAutosave();
    }
  };
  const onPageHide = () => {
    flushPendingAutosave();
  };
  const onBeforeUnload = () => {
    flushPendingAutosave();
  };

  // Autosave only when persisted fields change.
  const unsubscribe = useEditorStore.subscribe((state, previousState) => {
    const didDocumentChange = state.document !== previousState.document;
    const didCameraChange = !areCamerasEqual(state.camera, previousState.camera);
    if (!didDocumentChange && !didCameraChange) return;

    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }

    autosaveTimeout = setTimeout(flushAutosave, DOCUMENT_AUTOSAVE_DEBOUNCE_MS);
  });

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);

  window.__spaceforgeEditorAutosaveCleanup__ = () => {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
      autosaveTimeout = null;
    }
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}
