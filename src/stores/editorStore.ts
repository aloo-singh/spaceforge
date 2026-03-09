import { create } from "zustand";
import { INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
import {
  panCameraByScreenDelta,
  zoomCameraToScreenPoint,
} from "@/lib/editor/camera";
import type { CameraState, Point, ScreenPoint, ViewportSize } from "@/lib/editor/types";

type RoomDraftState = {
  points: Point[];
};

type EditorState = {
  camera: CameraState;
  viewport: ViewportSize;
  roomDraft: RoomDraftState;
  setViewport: (width: number, height: number) => void;
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  setCameraCenterMm: (xMm: number, yMm: number) => void;
  addDraftPoint: (point: Point) => void;
  resetDraft: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
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
  addDraftPoint: (point) =>
    set((state) => ({
      roomDraft: {
        points: [...state.roomDraft.points, point],
      },
    })),
  resetDraft: () =>
    set({
      roomDraft: {
        points: [],
      },
    }),
}));
