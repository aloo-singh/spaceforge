import { create } from "zustand";
import { GRID_SIZE_MM, INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
import {
  applyEditorCommand,
  isMergeableRenameCommand,
  type EditorCommand,
} from "@/lib/editor/history";
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
import type { CameraState, Point, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";

type RoomDraftState = {
  points: Point[];
};

type DocumentState = {
  rooms: Room[];
};

type EditorState = {
  document: DocumentState;
  camera: CameraState;
  viewport: ViewportSize;
  roomDraft: RoomDraftState;
  selectedRoomId: string | null;
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
  updateRoomName: (roomId: string, name: string) => void;
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

export const useEditorStore = create<EditorState>((set, get) => ({
  document: {
    rooms: [],
  },
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
          previousSelectedRoomId: state.selectedRoomId,
        };
        const nextState = applyEditorCommand(state, command, "redo");
        return {
          ...nextState,
          roomDraft: {
            points: [],
          },
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

      const command: EditorCommand = {
        type: "set-selection",
        previousSelectedRoomId: state.selectedRoomId,
        nextSelectedRoomId: roomId,
      };
      const nextState = applyEditorCommand(state, command, "redo");

      return {
        ...nextState,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  clearRoomSelection: () => get().selectRoomById(null),
  updateRoomName: (roomId, name) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room || room.name === name) return state;

      const lastCommand = state.history.past[state.history.past.length - 1];
      if (
        lastCommand &&
        state.history.future.length === 0 &&
        isMergeableRenameCommand(lastCommand, roomId)
      ) {
        const mergedCommand: EditorCommand = {
          ...lastCommand,
          nextName: name,
        };
        const nextState = applyEditorCommand(state, mergedCommand, "redo");

        return {
          ...nextState,
          history: {
            past: [...state.history.past.slice(0, -1), mergedCommand],
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      const command: EditorCommand = {
        type: "rename-room",
        roomId,
        previousName: room.name,
        nextName: name,
      };
      const nextState = applyEditorCommand(state, command, "redo");

      return {
        ...nextState,
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
      const nextState = applyEditorCommand(state, command, "undo");
      const nextPast = state.history.past.slice(0, -1);
      const nextFuture = [command, ...state.history.future];

      return {
        ...nextState,
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
      const nextState = applyEditorCommand(state, command, "redo");
      const nextPast = pushToPast(state.history.past, command);

      return {
        ...nextState,
        history: {
          past: nextPast,
          future: remainingFuture,
        },
        canUndo: true,
        canRedo: remainingFuture.length > 0,
      };
    }),
}));
