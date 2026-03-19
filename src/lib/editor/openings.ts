import { getAxisAlignedRoomBounds, type RoomRectBounds } from "@/lib/editor/rectRoomResize";
import type { Point, Room, RoomOpening, RoomWall } from "@/lib/editor/types";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
