import { worldToScreen } from "@/lib/editor/camera";
import { getRoomDeclutterState } from "@/lib/editor/roomDeclutter";
import { getMeasurementTextScale, type EditorSettings } from "@/lib/editor/settings";
import {
  formatMetricRoomAreaForRoom,
  shouldShowRoomArea,
} from "@/lib/editor/measurements";
import { getPolygonLabelAnchor } from "@/lib/editor/roomGeometry";
import type { CameraState, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";
import { MEASUREMENT_TEXT_FONT_FAMILY, UI_TEXT_FONT_FAMILY } from "@/lib/fonts";

export const ROOM_LABEL_NAME_FONT_FAMILY = UI_TEXT_FONT_FAMILY;
export const ROOM_LABEL_NAME_FONT_SIZE_PX = 13;
export const ROOM_LABEL_NAME_FONT_WEIGHT = "500";
export const ROOM_LABEL_AREA_FONT_FAMILY = MEASUREMENT_TEXT_FONT_FAMILY;
export const ROOM_LABEL_AREA_FONT_SIZE_PX = 11;
export const ROOM_LABEL_AREA_FONT_WEIGHT = "500";

const ROOM_LABEL_MIN_WIDTH_PX = 40;
const ROOM_LABEL_PADDING_X_PX = 9;
const ROOM_LABEL_PADDING_Y_PX = 5;
const ROOM_LABEL_AREA_OFFSET_Y_PX = 5;
const ROOM_LABEL_PLACEHOLDER_TEXT = "Untitled";

export type RoomLabelLayout = {
  roomId: string;
  center: ScreenPoint;
  nameText: string;
  isPlaceholderName: boolean;
  areaText: string | null;
  nameCenterY: number;
  areaCenterY: number | null;
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
  viewport: ViewportSize,
  settings?: Pick<EditorSettings, "measurementFontSize">
): RoomLabelLayout | null {
  if (room.points.length < 3) return null;
  const trimmedName = room.name.trim();
  const isPlaceholderName = trimmedName.length === 0;
  const nameText = isPlaceholderName ? ROOM_LABEL_PLACEHOLDER_TEXT : trimmedName;
  const declutter = getRoomDeclutterState(room, camera, viewport);
  if (!declutter.showLabel) return null;

  const areaText =
    declutter.showArea && shouldShowRoomArea(room) ? formatMetricRoomAreaForRoom(room) : null;
  const measurementTextScale = settings ? getMeasurementTextScale(settings) : 1;
  const areaFontSizePx = ROOM_LABEL_AREA_FONT_SIZE_PX * measurementTextScale;

  const anchorWorld = getPolygonLabelAnchor(room.points);
  if (!anchorWorld) return null;

  const center = worldToScreen(anchorWorld, camera, viewport);
  const estimatedNameWidth = estimateLabelTextWidthPx(nameText, ROOM_LABEL_NAME_FONT_SIZE_PX);
  const width = Math.max(ROOM_LABEL_MIN_WIDTH_PX, estimatedNameWidth + ROOM_LABEL_PADDING_X_PX * 2);
  const height = ROOM_LABEL_NAME_FONT_SIZE_PX + ROOM_LABEL_PADDING_Y_PX * 2;
  const nameCenterY = center.y;
  const areaCenterY = areaText
    ? center.y +
      height / 2 +
      ROOM_LABEL_AREA_OFFSET_Y_PX * measurementTextScale +
      areaFontSizePx / 2
    : null;

  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y - height / 2;
  const bottom = center.y + height / 2;

  return {
    roomId: room.id,
    center,
    nameText,
    isPlaceholderName,
    areaText,
    nameCenterY,
    areaCenterY,
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

function estimateLabelTextWidthPx(text: string, fontSizePx = ROOM_LABEL_NAME_FONT_SIZE_PX): number {
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

  return width * (fontSizePx / ROOM_LABEL_NAME_FONT_SIZE_PX);
}
