import type { Room } from "@/lib/editor/types";

export type LayoutBounds2d = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type LayoutDocumentLike = {
  rooms: Room[];
};

export function getLayoutBoundsFromDocument(document: LayoutDocumentLike): LayoutBounds2d | null {
  return getLayoutBoundsFromRooms(document.rooms);
}

export function getLayoutBoundsFromRooms(rooms: Room[]): LayoutBounds2d | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let hasAnyPoint = false;

  for (const room of rooms) {
    for (const point of room.points) {
      hasAnyPoint = true;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  // Empty documents (or rooms with no points) have no drawable layout bounds.
  if (!hasAnyPoint) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
