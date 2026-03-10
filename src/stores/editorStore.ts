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
import { loadEditorSnapshot } from "@/lib/editor/editorPersistence";
import type { CameraState, Point, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";

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
  startRoomRenameSession: (roomId: string) => void;
  updateRoomRenameDraft: (roomId: string, name: string) => void;
  commitRoomRenameSession: (options?: { deselectIfUnchanged?: boolean }) => void;
  cancelRoomRenameSession: () => void;
  updateRoomName: (roomId: string, name: string) => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  undo: () => void;
  redo: () => void;
};

const HISTORY_LIMIT = 100;

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

function getSelectionIfRoomExists(roomId: string | null, document: DocumentState): string | null {
  if (!roomId) return null;
  return document.rooms.some((room) => room.id === roomId) ? roomId : null;
}

function createInitialDocumentState(): DocumentState {
  const snapshot = loadEditorSnapshot();
  if (!snapshot) {
    return {
      rooms: [],
    };
  }

  return snapshot.document;
}

export const useEditorStore = create<EditorState>((set) => ({
  document: createInitialDocumentState(),
  camera: {
    xMm: 0,
    yMm: 0,
    pixelsPerMm: INITIAL_PIXELS_PER_MM,
  },
  viewport: {
    width: 1,
    height: 1,
  },
  roomDraft: {
    points: [],
  },
  selectedRoomId: null,
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
        renameSession: null,
      };
    }),
  clearRoomSelection: () =>
    set({
      selectedRoomId: null,
      renameSession: null,
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
