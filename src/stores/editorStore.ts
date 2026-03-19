import { create } from "zustand";
import { GRID_SIZE_MM, INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
import { applyEditorCommand, type EditorCommand } from "@/lib/editor/history";
import {
  panCameraByScreenDelta,
  zoomCameraToScreenPoint,
} from "@/lib/editor/camera";
import { getCameraFitTarget, getDrawingAwareMinPixelsPerMm } from "@/lib/editor/cameraFit";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import {
  easeResetCameraTransition,
  interpolateCamera,
  RESET_CAMERA_TRANSITION_DURATION_MS,
} from "@/lib/editor/cameraTransition";
import {
  applyCandidatePointToDraftPath,
  getDraftLoopClosureResultFromPath,
  getOrthogonalSegmentAxis,
  getOrthogonalSnappedPoint,
  normalizeDraftPointChain,
  isZeroLengthSegment,
  pointsEqual,
  snapPointToGrid,
} from "@/lib/editor/geometry";
import {
  isAxisAlignedRectangle,
  isOrthogonalPointPath,
  isSimplePolygon,
} from "@/lib/editor/roomGeometry";
import { translateRoomPoints } from "@/lib/editor/roomTranslation";
import {
  PERSISTED_HISTORY_STATE_LIMIT,
  loadEditorSnapshotForHydration,
  saveEditorSnapshot,
} from "@/lib/editor/editorPersistence";
import {
  areEditorSettingsEqual,
  cloneEditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettings,
} from "@/lib/editor/settings";
import {
  buildPersistedHistorySnapshot,
  type PersistedHistorySnapshot,
  hydrateCommandHistoryFromSnapshots,
} from "@/lib/editor/persistedHistory";
import type {
  CameraState,
  Point,
  Room,
  RoomWallSelection,
  ScreenPoint,
  ViewportSize,
} from "@/lib/editor/types";

declare global {
  interface Window {
    __spaceforgeEditorAutosaveCleanup__?: () => void;
  }
}

type RoomDraftState = {
  points: Point[];
  history: Point[][];
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
  settings: EditorSettings;
  isDimensionsVisibilityOverrideActive: boolean;
  viewport: ViewportSize;
  roomDraft: RoomDraftState;
  selectedRoomId: string | null;
  selectedWall: RoomWallSelection | null;
  shouldFocusSelectedRoomNameInput: boolean;
  renameSession: RenameSessionState;
  history: {
    past: EditorCommand[];
    future: EditorCommand[];
  };
  canUndo: boolean;
  canRedo: boolean;
  setDimensionsVisibilityOverrideActive: (isActive: boolean) => void;
  setViewport: (width: number, height: number) => void;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  setCameraCenterMm: (xMm: number, yMm: number) => void;
  placeDraftPointFromCursor: (cursorWorld: Point) => void;
  stepBackDraft: () => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  selectWallByRoomId: (roomId: string, wall: RoomWallSelection["wall"]) => void;
  clearSelectedWall: () => void;
  clearRoomSelection: () => void;
  consumeSelectedRoomNameInputFocusRequest: () => void;
  startRoomRenameSession: (roomId: string) => void;
  updateRoomRenameDraft: (roomId: string, name: string) => void;
  commitRoomRenameSession: (options?: { deselectIfUnchanged?: boolean }) => void;
  cancelRoomRenameSession: () => void;
  deleteSelectedRoom: () => void;
  updateRoomName: (roomId: string, name: string) => void;
  moveRoomByDelta: (roomId: string, delta: Point) => void;
  previewRoomMove: (roomId: string, nextPoints: Point[]) => void;
  commitRoomMove: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  resetCamera: () => void;
  resetCanvas: () => void;
  undo: () => void;
  redo: () => void;
};

const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 300;
const DEFAULT_DOCUMENT_STATE: DocumentState = {
  rooms: [],
};
const DEFAULT_CAMERA_STATE: CameraState = {
  xMm: 0,
  yMm: 0,
  pixelsPerMm: INITIAL_PIXELS_PER_MM,
};
const EMPTY_ROOM_DRAFT: RoomDraftState = {
  points: [],
  history: [],
};
const HISTORY_LIMIT = PERSISTED_HISTORY_STATE_LIMIT - 1;

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

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }));
}

function areCamerasEqual(a: CameraState, b: CameraState): boolean {
  return a.xMm === b.xMm && a.yMm === b.yMm && a.pixelsPerMm === b.pixelsPerMm;
}

function getSelectionIfRoomExists(roomId: string | null, document: DocumentState): string | null {
  if (!roomId) return null;
  return document.rooms.some((room) => room.id === roomId) ? roomId : null;
}

function getSelectedWallIfRoomExists(
  selectedWall: RoomWallSelection | null,
  document: DocumentState
): RoomWallSelection | null {
  if (!selectedWall) return null;
  const room = document.rooms.find((candidate) => candidate.id === selectedWall.roomId);
  if (!room) return null;
  return isAxisAlignedRectangle(room.points) ? selectedWall : null;
}

function getSafePersistedHistorySnapshot(
  document: DocumentState,
  history: EditorState["history"]
): PersistedHistorySnapshot {
  return (
    buildPersistedHistorySnapshot(document, history, PERSISTED_HISTORY_STATE_LIMIT) ?? {
      historyStack: [
        {
          rooms: document.rooms.map((room) => ({
            id: room.id,
            name: room.name,
            points: room.points.map((point) => ({ ...point })),
          })),
        },
      ],
      historyIndex: 0,
    }
  );
}

const hydrationSnapshot = loadEditorSnapshotForHydration();
const hydratedHistoryState =
  hydrationSnapshot?.historyStack && typeof hydrationSnapshot.historyIndex === "number"
    ? hydrateCommandHistoryFromSnapshots(
        {
          historyStack: hydrationSnapshot.historyStack,
          historyIndex: hydrationSnapshot.historyIndex,
        },
        hydrationSnapshot.document,
        PERSISTED_HISTORY_STATE_LIMIT
      ) ?? { past: [], future: [] }
    : { past: [], future: [] };
// Manual QA after persistence changes:
// 1. Edit, undo, refresh, redo.
// 2. Edit, undo, refresh, make a new edit, confirm redo stays unavailable.
// 3. Exceed the history cap, refresh, and confirm undo only reaches the retained window.
// 4. Corrupt stored history manually, refresh, and confirm layout/camera restore without history.

function createInitialDocumentState(): DocumentState {
  return hydrationSnapshot?.document ?? DEFAULT_DOCUMENT_STATE;
}

function createInitialCameraState(): CameraState {
  return hydrationSnapshot?.camera ?? DEFAULT_CAMERA_STATE;
}

function createInitialEditorSettings(): EditorSettings {
  return hydrationSnapshot?.settings ?? cloneEditorSettings(DEFAULT_EDITOR_SETTINGS);
}

type ActiveResetCameraAnimation = {
  frameId: number;
  sequence: number;
  targetCamera: CameraState;
};

let activeResetCameraAnimation: ActiveResetCameraAnimation | null = null;
let nextResetCameraAnimationSequence = 0;

function stopResetCameraAnimation() {
  nextResetCameraAnimationSequence += 1;

  if (!activeResetCameraAnimation || typeof window === "undefined") {
    activeResetCameraAnimation = null;
    return;
  }

  window.cancelAnimationFrame(activeResetCameraAnimation.frameId);
  activeResetCameraAnimation = null;
}

function hasActiveResetCameraAnimationTarget(targetCamera: CameraState): boolean {
  return (
    activeResetCameraAnimation !== null &&
    areCamerasEqual(activeResetCameraAnimation.targetCamera, targetCamera)
  );
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createInitialDocumentState(),
  camera: createInitialCameraState(),
  settings: createInitialEditorSettings(),
  isDimensionsVisibilityOverrideActive: false,
  viewport: {
    width: 1,
    height: 1,
  },
  roomDraft: EMPTY_ROOM_DRAFT,
  selectedRoomId: null,
  selectedWall: null,
  shouldFocusSelectedRoomNameInput: false,
  renameSession: null,
  history: {
    past: hydratedHistoryState.past,
    future: hydratedHistoryState.future,
  },
  canUndo: hydratedHistoryState.past.length > 0,
  canRedo: hydratedHistoryState.future.length > 0,
  setDimensionsVisibilityOverrideActive: (isActive) =>
    set((state) => {
      if (state.isDimensionsVisibilityOverrideActive === isActive) return state;

      return {
        isDimensionsVisibilityOverrideActive: isActive,
      };
    }),
  setViewport: (width, height) => set({ viewport: { width, height } }),
  updateSettings: (settings) =>
    set((state) => {
      const nextSettings: EditorSettings = {
        ...state.settings,
        ...settings,
      };
      if (areEditorSettingsEqual(state.settings, nextSettings)) return state;

      return {
        settings: nextSettings,
      };
    }),
  panCameraByPx: (delta) => {
    stopResetCameraAnimation();
    set((state) => ({
      camera: panCameraByScreenDelta(state.camera, delta),
    }));
  },
  zoomAtScreenPoint: (screenPoint, scaleFactor) => {
    stopResetCameraAnimation();
    set((state) => {
      const layoutBounds = getLayoutBoundsFromRooms(state.document.rooms);
      const minimumPixelsPerMm = getDrawingAwareMinPixelsPerMm({
        layoutBounds,
        viewport: state.viewport,
      });

      return {
        camera: zoomCameraToScreenPoint(
          state.camera,
          state.viewport,
          screenPoint,
          state.camera.pixelsPerMm * scaleFactor,
          minimumPixelsPerMm
        ),
      };
    });
  },
  setCameraCenterMm: (xMm, yMm) => {
    stopResetCameraAnimation();
    set((state) => ({
      camera: {
        ...state.camera,
        xMm,
        yMm,
      },
    }));
  },
  placeDraftPointFromCursor: (cursorWorld) =>
    set((state) => {
      const draftPoints = normalizeDraftPointChain(state.roomDraft.points);

      if (draftPoints.length === 0) {
        return {
          roomDraft: {
            points: [snapPointToGrid(cursorWorld, GRID_SIZE_MM)],
            history: [],
          },
        };
      }

      const lastPoint = draftPoints[draftPoints.length - 1];
      const nextPoint = getOrthogonalSnappedPoint(lastPoint, cursorWorld, GRID_SIZE_MM);

      if (isZeroLengthSegment(lastPoint, nextPoint)) return state;

      const startPoint = draftPoints[0];
      if (pointsEqual(nextPoint, startPoint)) {
        if (draftPoints.length < 4) return state;
        if (!isValidDraftRoomClosure(draftPoints)) return state;
        return completeDraftRoom(state, draftPoints);
      }

      const nextDraftPoints = applyCandidatePointToDraftPath(draftPoints, nextPoint);
      const loopClosure = getDraftLoopClosureResultFromPath(nextDraftPoints);
      if (loopClosure && !pointsEqual(nextPoint, startPoint)) {
        return completeDraftRoom(state, loopClosure.committedLoop);
      }

      if (!isValidDraftPathProgression(draftPoints, nextDraftPoints, nextPoint)) {
        return state;
      }

      if (arePointListsEqual(draftPoints, nextDraftPoints)) return state;

      return {
        roomDraft: {
          points: nextDraftPoints,
          history: [...state.roomDraft.history, clonePoints(draftPoints)],
        },
      };
    }),
  stepBackDraft: () =>
    set((state) => {
      if (state.roomDraft.points.length === 0) return state;

      const previousDraftPoints = state.roomDraft.history[state.roomDraft.history.length - 1] ?? null;
      if (!previousDraftPoints) {
        return {
          roomDraft: EMPTY_ROOM_DRAFT,
        };
      }

      return {
        roomDraft: {
          points: clonePoints(previousDraftPoints),
          history: state.roomDraft.history
            .slice(0, -1)
            .map((snapshot) => clonePoints(snapshot)),
        },
      };
    }),
  resetDraft: () =>
    set({
      roomDraft: EMPTY_ROOM_DRAFT,
    }),
  selectRoomById: (roomId) =>
    set((state) => {
      if (state.selectedRoomId === roomId && state.selectedWall === null) return state;

      return {
        selectedRoomId: roomId,
        selectedWall: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  selectWallByRoomId: (roomId, wall) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!isAxisAlignedRectangle(room.points)) {
        return {
          selectedRoomId: roomId,
          selectedWall: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      if (
        state.selectedRoomId === roomId &&
        state.selectedWall?.roomId === roomId &&
        state.selectedWall.wall === wall
      ) {
        return state;
      }

      return {
        selectedRoomId: roomId,
        selectedWall: { roomId, wall },
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  clearSelectedWall: () =>
    set((state) => {
      if (state.selectedWall === null) return state;
      return {
        selectedWall: null,
      };
    }),
  clearRoomSelection: () =>
    set({
      selectedRoomId: null,
      selectedWall: null,
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
        return { selectedRoomId: null, selectedWall: null };
      }

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      if (!room) {
        return {
          selectedRoomId: null,
          selectedWall: null,
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
          selectedWall: null,
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
        selectedWall: null,
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
          selectedWall: null,
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
        selectedWall: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  deleteSelectedRoom: () =>
    set((state) => {
      const selectedRoomId = state.selectedRoomId;
      if (!selectedRoomId) return state;

      const previousIndex = state.document.rooms.findIndex((room) => room.id === selectedRoomId);
      if (previousIndex < 0) {
        return {
          selectedRoomId: null,
          selectedWall: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const room = state.document.rooms[previousIndex];
      const command: EditorCommand = {
        type: "delete-room",
        room: {
          id: room.id,
          name: room.name,
          points: room.points.map((point) => ({ ...point })),
        },
        previousIndex,
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedRoomId: null,
        selectedWall: null,
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
  moveRoomByDelta: (roomId, delta) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (delta.x === 0 && delta.y === 0) return state;

      const nextPoints = translateRoomPoints(room.points, delta);
      const command: EditorCommand = {
        type: "move-room",
        roomId,
        previousPoints: room.points.map((point) => ({ ...point })),
        nextPoints: nextPoints.map((point) => ({ ...point })),
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
  previewRoomMove: (roomId, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(room.points, nextPoints)) return state;

      return {
        document: updateRoomPointsInDocument(state.document, roomId, nextPoints),
      };
    }),
  commitRoomMove: (roomId, previousPoints, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(previousPoints, nextPoints)) return state;

      const command: EditorCommand = {
        type: "move-room",
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
  resetCamera: () => {
    const state = get();
    const targetCamera = getCameraFitTarget({
      rooms: state.document.rooms,
      viewport: state.viewport,
      emptyLayoutCamera: DEFAULT_CAMERA_STATE,
    }).camera;

    if (areCamerasEqual(state.camera, targetCamera)) return;
    if (hasActiveResetCameraAnimationTarget(targetCamera)) return;

    stopResetCameraAnimation();

    if (typeof window === "undefined") {
      set({ camera: targetCamera });
      return;
    }

    const startCamera = state.camera;
    const startTime = window.performance.now();
    const sequence = nextResetCameraAnimationSequence;

    const step = (now: number) => {
      if (activeResetCameraAnimation?.sequence !== sequence) return;

      const elapsedMs = now - startTime;
      const progress = Math.min(1, elapsedMs / RESET_CAMERA_TRANSITION_DURATION_MS);
      const easedProgress = easeResetCameraTransition(progress);
      const nextCamera =
        progress >= 1
          ? targetCamera
          : interpolateCamera(startCamera, targetCamera, easedProgress);

      set({ camera: nextCamera });

      if (progress >= 1) {
        activeResetCameraAnimation = null;
        return;
      }

      activeResetCameraAnimation = {
        frameId: window.requestAnimationFrame(step),
        sequence,
        targetCamera,
      };
    };

    activeResetCameraAnimation = {
      frameId: window.requestAnimationFrame(step),
      sequence,
      targetCamera,
    };
  },
  resetCanvas: () => {
    stopResetCameraAnimation();
    set((state) => ({
      document: {
        rooms: [],
      },
      camera: { ...DEFAULT_CAMERA_STATE },
      roomDraft: {
        points: [],
        history: [],
      },
      selectedRoomId: null,
      selectedWall: null,
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
      history: {
        past: [],
        future: [],
      },
      canUndo: false,
      canRedo: false,
      viewport: state.viewport,
    }));
  },
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
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, nextDocument),
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
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, nextDocument),
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
  let lastSavedPersistedSignature = JSON.stringify((() => {
    const state = useEditorStore.getState();
    const historySnapshot = getSafePersistedHistorySnapshot(state.document, state.history);

    return {
      document: state.document,
      camera: state.camera,
      settings: state.settings,
      historyStack: historySnapshot.historyStack,
      historyIndex: historySnapshot.historyIndex,
    };
  })());

  const flushAutosave = () => {
    autosaveTimeout = null;
    const state = useEditorStore.getState();
    const historySnapshot = getSafePersistedHistorySnapshot(state.document, state.history);
    const nextPersistedSignature = JSON.stringify({
      document: state.document,
      camera: state.camera,
      settings: state.settings,
      historyStack: historySnapshot.historyStack,
      historyIndex: historySnapshot.historyIndex,
    });
    if (nextPersistedSignature === lastSavedPersistedSignature) return;

    const didSave = saveEditorSnapshot({
      document: state.document,
      camera: state.camera,
      settings: state.settings,
      historyStack: historySnapshot.historyStack,
      historyIndex: historySnapshot.historyIndex,
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
    const didSettingsChange = !areEditorSettingsEqual(state.settings, previousState.settings);
    const didPastChange = state.history.past !== previousState.history.past;
    const didFutureChange = state.history.future !== previousState.history.future;
    if (!didDocumentChange && !didCameraChange && !didSettingsChange && !didPastChange && !didFutureChange) return;

    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }

    autosaveTimeout = setTimeout(flushAutosave, DOCUMENT_AUTOSAVE_DEBOUNCE_MS);
  });

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);

  window.__spaceforgeEditorAutosaveCleanup__ = () => {
    stopResetCameraAnimation();
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

function isValidDraftRoomClosure(points: Point[]): boolean {
  return isOrthogonalPointPath(points, { closed: true }) && isSimplePolygon(points);
}

function completeDraftRoom(state: EditorState, draftPoints: Point[]) {
  const normalizedRoomPoints = normalizeDraftPointChain(draftPoints);
  if (normalizedRoomPoints.length < 4) return state;
  if (!isValidDraftRoomClosure(normalizedRoomPoints)) return state;

  const room: Room = {
    id: createRoomId(),
    name: `Room ${state.document.rooms.length + 1}`,
    points: normalizedRoomPoints.map((point) => ({ ...point })),
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
      history: [],
    },
    selectedRoomId: room.id,
    selectedWall: null,
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

function isValidDraftPathProgression(
  previousDraftPoints: Point[],
  nextDraftPoints: Point[],
  rawNextPoint: Point
): boolean {
  if (nextDraftPoints.length === 0) return false;
  if (nextDraftPoints.length === 1) return true;

  const terminalPreviousPoint = nextDraftPoints[nextDraftPoints.length - 2];
  const terminalPoint = nextDraftPoints[nextDraftPoints.length - 1];
  if (pointsEqual(terminalPreviousPoint, terminalPoint)) {
    return false;
  }

  const isTailAdjustment = nextDraftPoints.length === previousDraftPoints.length;
  if (isTailAdjustment) {
    return !nextDraftPoints
      .slice(0, -1)
      .some((point, index) => index !== 0 && pointsEqual(point, terminalPoint));
  }

  if (previousDraftPoints.length < 2) {
    return true;
  }

  const previousPoint = previousDraftPoints[previousDraftPoints.length - 2];
  const currentPoint = previousDraftPoints[previousDraftPoints.length - 1];
  const previousAxis = getOrthogonalSegmentAxis(previousPoint, currentPoint);
  const nextAxis = getOrthogonalSegmentAxis(currentPoint, rawNextPoint);

  if (!previousAxis || !nextAxis) return false;
  if (previousAxis === nextAxis) return false;

  return !nextDraftPoints
    .slice(0, -1)
    .some((point, index) => index !== 0 && pointsEqual(point, terminalPoint));
}
