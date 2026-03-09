import { worldToScreen } from "@/lib/editor/camera";
import { getPolygonLabelAnchor } from "@/lib/editor/roomGeometry";
import type { CameraState, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";

export const ROOM_LABEL_FONT_FAMILY = "Inter, sans-serif";
export const ROOM_LABEL_FONT_SIZE_PX = 13;
export const ROOM_LABEL_FONT_WEIGHT = "500";

const ROOM_LABEL_MIN_WIDTH_PX = 40;
const ROOM_LABEL_PADDING_X_PX = 9;
const ROOM_LABEL_PADDING_Y_PX = 5;
const ROOM_LABEL_PLACEHOLDER_TEXT = "Untitled";

export type RoomLabelLayout = {
  roomId: string;
  text: string;
  isPlaceholder: boolean;
  center: ScreenPoint;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  borderRadius: number;
};

/**
 * Computes a lightweight, deterministic label pill layout in screen space.
 */
export function getRoomLabelLayout(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize
): RoomLabelLayout | null {
  if (room.points.length < 3) return null;
  const trimmedName = room.name.trim();
  const isPlaceholder = trimmedName.length === 0;
  const text = isPlaceholder ? ROOM_LABEL_PLACEHOLDER_TEXT : trimmedName;

  const anchorWorld = getPolygonLabelAnchor(room.points);
  if (!anchorWorld) return null;

  const center = worldToScreen(anchorWorld, camera, viewport);
  const estimatedTextWidth = estimateLabelTextWidthPx(text);
  const width = Math.max(ROOM_LABEL_MIN_WIDTH_PX, estimatedTextWidth + ROOM_LABEL_PADDING_X_PX * 2);
  const height = ROOM_LABEL_FONT_SIZE_PX + ROOM_LABEL_PADDING_Y_PX * 2;

  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y - height / 2;
  const bottom = center.y + height / 2;

  return {
    roomId: room.id,
    text,
    isPlaceholder,
    center,
    width,
    height,
    left,
    right,
    top,
    bottom,
    borderRadius: Math.floor(height / 2),
  };
}

/**
 * Returns the top-most room whose label pill contains the given screen point.
 */
export function findRoomLabelAtScreenPoint(
  rooms: Room[],
  screenPoint: ScreenPoint,
  camera: CameraState,
  viewport: ViewportSize
): Room | null {
  for (let i = rooms.length - 1; i >= 0; i -= 1) {
    const room = rooms[i];
    const layout = getRoomLabelLayout(room, camera, viewport);
    if (!layout) continue;

    if (isScreenPointInsideRoomLabel(screenPoint, layout)) {
      return room;
    }
  }

  return null;
}

export function isScreenPointInsideRoomLabel(
  screenPoint: ScreenPoint,
  layout: RoomLabelLayout
): boolean {
  return (
    screenPoint.x >= layout.left &&
    screenPoint.x <= layout.right &&
    screenPoint.y >= layout.top &&
    screenPoint.y <= layout.bottom
  );
}

function estimateLabelTextWidthPx(text: string): number {
  let width = 0;

  for (const character of text) {
    if (" il.,'|!".includes(character)) {
      width += 3.8;
      continue;
    }

    if ("MW@#%&".includes(character)) {
      width += 9;
      continue;
    }

    width += 7;
  }

  return width;
}
