import { worldToScreen } from "@/lib/editor/camera";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";

export const ROOM_DECLUTTER_HANDLE_MIN_SHORT_SIDE_PX = 72;
export const ROOM_DECLUTTER_LABEL_MIN_SHORT_SIDE_PX = 44;
export const ROOM_DECLUTTER_AREA_MIN_SHORT_SIDE_PX = 72;
export const ROOM_DECLUTTER_AREA_MIN_LONG_SIDE_PX = 96;

export type RoomScreenBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  shortSide: number;
  longSide: number;
};

export type RoomDeclutterState = {
  screenBounds: RoomScreenBounds | null;
  showSelectionControls: boolean;
  showLabel: boolean;
  showArea: boolean;
};

export function getRoomDeclutterState(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize
): RoomDeclutterState {
  const screenBounds = getRoomScreenBounds(room.points, camera, viewport);
  const shortSide = screenBounds?.shortSide ?? 0;
  const longSide = screenBounds?.longSide ?? 0;

  return {
    screenBounds,
    showSelectionControls: shortSide >= ROOM_DECLUTTER_HANDLE_MIN_SHORT_SIDE_PX,
    showLabel: shortSide >= ROOM_DECLUTTER_LABEL_MIN_SHORT_SIDE_PX,
    showArea:
      shortSide >= ROOM_DECLUTTER_AREA_MIN_SHORT_SIDE_PX &&
      longSide >= ROOM_DECLUTTER_AREA_MIN_LONG_SIDE_PX,
  };
}

export function getRoomScreenBounds(
  points: Point[],
  camera: CameraState,
  viewport: ViewportSize
): RoomScreenBounds | null {
  if (points.length < 3) return null;

  const screenPoints = points.map((point) => worldToScreen(point, camera, viewport));
  const xs = screenPoints.map((point) => point.x);
  const ys = screenPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    shortSide: Math.min(width, height),
    longSide: Math.max(width, height),
  };
}
