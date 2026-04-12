import { snapToGrid } from "@/lib/editor/geometry";
import type { Point } from "@/lib/editor/types";

export function translateRoomPoints(points: Point[], delta: Point): Point[] {
  return translateRoomPointsWithOptionalGrid(points, delta);
}

export function translateRoomPointsOnGrid(
  points: Point[],
  delta: Point,
  gridSizeMm: number
): Point[] {
  if (points.length === 0) return [];
  if (gridSizeMm <= 0) return translateRoomPointsWithOptionalGrid(points, delta);

  if (arePointsAlignedToGrid(points, gridSizeMm)) {
    const snappedDelta = {
      x: snapToGrid(delta.x, gridSizeMm),
      y: snapToGrid(delta.y, gridSizeMm),
    };

    return points.map((point) => ({
      x: point.x + snappedDelta.x,
      y: point.y + snappedDelta.y,
    }));
  }

  return translateRoomPointsWithOptionalGrid(points, delta, gridSizeMm);
}

function translateRoomPointsWithOptionalGrid(
  points: Point[],
  delta: Point,
  gridSizeMm?: number
): Point[] {
  return points.map((point) => ({
      x: gridSizeMm === undefined ? point.x + delta.x : snapToGrid(point.x + delta.x, gridSizeMm),
    y: gridSizeMm === undefined ? point.y + delta.y : snapToGrid(point.y + delta.y, gridSizeMm),
  }));
}

function arePointsAlignedToGrid(points: Point[], gridSizeMm: number): boolean {
  return points.every(
    (point) => point.x % gridSizeMm === 0 && point.y % gridSizeMm === 0
  );
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

export function getRoomTranslationDelta(
  startWorldPoint: Point,
  currentWorldPoint: Point
): Point {
  return {
    x: currentWorldPoint.x - startWorldPoint.x,
    y: currentWorldPoint.y - startWorldPoint.y,
  };
}
