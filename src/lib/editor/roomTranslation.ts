import { snapToGrid } from "@/lib/editor/geometry";
import type { Point } from "@/lib/editor/types";

export function translateRoomPoints(points: Point[], delta: Point): Point[] {
  return points.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  }));
}

export function getSnappedRoomTranslationDelta(
  startWorldPoint: Point,
  currentWorldPoint: Point,
  gridSizeMm: number
): Point {
  return {
    x: snapToGrid(currentWorldPoint.x - startWorldPoint.x, gridSizeMm),
    y: snapToGrid(currentWorldPoint.y - startWorldPoint.y, gridSizeMm),
  };
}
