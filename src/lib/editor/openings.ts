import { worldToScreen } from "@/lib/editor/camera";
import { getAxisAlignedRoomBounds, type RoomRectBounds } from "@/lib/editor/rectRoomResize";
import type {
  CameraState,
  OpeningType,
  Point,
  Room,
  RoomOpening,
  RoomOpeningSelection,
  RoomWall,
  ViewportSize,
} from "@/lib/editor/types";

export const DEFAULT_DOOR_WIDTH_MM = 900;
export const DEFAULT_WINDOW_WIDTH_MM = 1200;
const OPENING_HIT_PADDING_PX = 10;
const OPENING_HIT_DEPTH_PX = 18;

export type RoomWallSegment = {
  wall: RoomWall;
  axis: "horizontal" | "vertical";
  start: Point;
  end: Point;
  interiorNormal: Point;
  lengthMm: number;
};

export type ResolvedRoomOpeningLayout = {
  opening: RoomOpening;
  wall: RoomWall;
  axis: RoomWallSegment["axis"];
  center: Point;
  start: Point;
  end: Point;
  interiorNormal: Point;
};

export function cloneRoomOpening(opening: RoomOpening): RoomOpening {
  return {
    id: opening.id,
    type: opening.type,
    wall: opening.wall,
    offsetMm: opening.offsetMm,
    widthMm: opening.widthMm,
  };
}

export function cloneRoomOpenings(openings: RoomOpening[]): RoomOpening[] {
  return openings.map(cloneRoomOpening);
}

export function areRoomOpeningsEqual(a: RoomOpening[], b: RoomOpening[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].type !== b[i].type ||
      a[i].wall !== b[i].wall ||
      a[i].offsetMm !== b[i].offsetMm ||
      a[i].widthMm !== b[i].widthMm
    ) {
      return false;
    }
  }

  return true;
}

export function getRoomWallSegment(bounds: RoomRectBounds, wall: RoomWall): RoomWallSegment | null {
  switch (wall) {
    case "top":
      return {
        wall,
        axis: "horizontal",
        start: { x: bounds.minX, y: bounds.minY },
        end: { x: bounds.maxX, y: bounds.minY },
        interiorNormal: { x: 0, y: 1 },
        lengthMm: bounds.maxX - bounds.minX,
      };
    case "bottom":
      return {
        wall,
        axis: "horizontal",
        start: { x: bounds.minX, y: bounds.maxY },
        end: { x: bounds.maxX, y: bounds.maxY },
        interiorNormal: { x: 0, y: -1 },
        lengthMm: bounds.maxX - bounds.minX,
      };
    case "left":
      return {
        wall,
        axis: "vertical",
        start: { x: bounds.minX, y: bounds.minY },
        end: { x: bounds.minX, y: bounds.maxY },
        interiorNormal: { x: 1, y: 0 },
        lengthMm: bounds.maxY - bounds.minY,
      };
    case "right":
      return {
        wall,
        axis: "vertical",
        start: { x: bounds.maxX, y: bounds.minY },
        end: { x: bounds.maxX, y: bounds.maxY },
        interiorNormal: { x: -1, y: 0 },
        lengthMm: bounds.maxY - bounds.minY,
      };
    default:
      return null;
  }
}

export function getResolvedRoomOpeningLayout(
  room: Room,
  opening: RoomOpening
): ResolvedRoomOpeningLayout | null {
  const bounds = getAxisAlignedRoomBounds(room);
  if (!bounds) return null;

  return getResolvedRoomOpeningLayoutFromBounds(bounds, opening);
}

export function createCenteredRoomOpening(
  room: Room,
  wall: RoomWall,
  type: OpeningType,
  id: string
): RoomOpening | null {
  const bounds = getAxisAlignedRoomBounds(room);
  if (!bounds) return null;

  const segment = getRoomWallSegment(bounds, wall);
  if (!segment || segment.lengthMm <= 0) return null;

  const widthMm = Math.min(getDefaultOpeningWidth(type), segment.lengthMm);
  if (widthMm <= 0) return null;

  return {
    id,
    type,
    wall,
    offsetMm: segment.lengthMm / 2,
    widthMm,
  };
}

export function findOpeningAtScreenPoint(
  rooms: Room[],
  screenPoint: Point,
  camera: CameraState,
  viewport: ViewportSize
): RoomOpeningSelection | null {
  for (let roomIndex = rooms.length - 1; roomIndex >= 0; roomIndex -= 1) {
    const room = rooms[roomIndex];

    for (let openingIndex = room.openings.length - 1; openingIndex >= 0; openingIndex -= 1) {
      const opening = room.openings[openingIndex];
      const layout = getResolvedRoomOpeningLayout(room, opening);
      if (!layout) continue;

      const start = worldToScreen(layout.start, camera, viewport);
      const end = worldToScreen(layout.end, camera, viewport);
      const center = worldToScreen(layout.center, camera, viewport);

      if (
        layout.axis === "horizontal" &&
        screenPoint.x >= Math.min(start.x, end.x) - OPENING_HIT_PADDING_PX &&
        screenPoint.x <= Math.max(start.x, end.x) + OPENING_HIT_PADDING_PX &&
        screenPoint.y >= center.y - OPENING_HIT_DEPTH_PX &&
        screenPoint.y <= center.y + OPENING_HIT_DEPTH_PX
      ) {
        return { roomId: room.id, openingId: opening.id };
      }

      if (
        layout.axis === "vertical" &&
        screenPoint.y >= Math.min(start.y, end.y) - OPENING_HIT_PADDING_PX &&
        screenPoint.y <= Math.max(start.y, end.y) + OPENING_HIT_PADDING_PX &&
        screenPoint.x >= center.x - OPENING_HIT_DEPTH_PX &&
        screenPoint.x <= center.x + OPENING_HIT_DEPTH_PX
      ) {
        return { roomId: room.id, openingId: opening.id };
      }
    }
  }

  return null;
}

export function getResolvedRoomOpeningLayoutFromBounds(
  bounds: RoomRectBounds,
  opening: RoomOpening
): ResolvedRoomOpeningLayout | null {
  const segment = getRoomWallSegment(bounds, opening.wall);
  if (!segment || segment.lengthMm <= 0 || opening.widthMm <= 0) return null;

  const centerOffsetMm = clamp(opening.offsetMm, 0, segment.lengthMm);
  const halfWidthMm = opening.widthMm / 2;
  const startOffsetMm = Math.max(0, centerOffsetMm - halfWidthMm);
  const endOffsetMm = Math.min(segment.lengthMm, centerOffsetMm + halfWidthMm);

  if (endOffsetMm <= startOffsetMm) return null;

  return {
    opening,
    wall: opening.wall,
    axis: segment.axis,
    center: getWallPointAtOffset(segment, centerOffsetMm),
    start: getWallPointAtOffset(segment, startOffsetMm),
    end: getWallPointAtOffset(segment, endOffsetMm),
    interiorNormal: segment.interiorNormal,
  };
}

function getWallPointAtOffset(segment: RoomWallSegment, offsetMm: number): Point {
  if (segment.axis === "horizontal") {
    return {
      x: segment.start.x + offsetMm,
      y: segment.start.y,
    };
  }

  return {
    x: segment.start.x,
    y: segment.start.y + offsetMm,
  };
}

function getDefaultOpeningWidth(type: OpeningType) {
  return type === "door" ? DEFAULT_DOOR_WIDTH_MM : DEFAULT_WINDOW_WIDTH_MM;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
