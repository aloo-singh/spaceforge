import { create } from "zustand";
import { GRID_SIZE_MM, INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
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
  setViewport: (width: number, height: number) => void;
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  setCameraCenterMm: (xMm: number, yMm: number) => void;
  placeDraftPointFromCursor: (cursorWorld: Point) => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  clearRoomSelection: () => void;
  updateRoomName: (roomId: string, name: string) => void;
};

function createRoomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `room-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export const useEditorStore = create<EditorState>((set) => ({
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
        return {
          selectedRoomId: null,
          document: {
            rooms: [
              ...state.document.rooms,
              {
                id: createRoomId(),
                name: `Room ${state.document.rooms.length + 1}`,
                points: roomPoints,
              },
            ],
          },
          roomDraft: {
            points: [],
          },
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
  selectRoomById: (roomId) => set({ selectedRoomId: roomId }),
  clearRoomSelection: () => set({ selectedRoomId: null }),
  updateRoomName: (roomId, name) =>
    set((state) => ({
      document: {
        rooms: state.document.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                name,
              }
            : room
        ),
      },
    })),
}));
