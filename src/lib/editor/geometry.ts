import type { Point } from "@/lib/editor/types";

export function snapToGrid(value: number, gridSizeMm: number): number {
  return Math.round(value / gridSizeMm) * gridSizeMm;
}

export function snapPointToGrid(point: Point, gridSizeMm: number): Point {
  return {
    x: snapToGrid(point.x, gridSizeMm),
    y: snapToGrid(point.y, gridSizeMm),
  };
}

export function projectOrthogonalPoint(anchor: Point, target: Point): Point {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: target.x, y: anchor.y };
  }

  return { x: anchor.x, y: target.y };
}

export function getOrthogonalSnappedPoint(
  anchor: Point,
  cursorWorld: Point,
  gridSizeMm: number
): Point {
  const snappedCursor = snapPointToGrid(cursorWorld, gridSizeMm);
  return projectOrthogonalPoint(anchor, snappedCursor);
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isOrthogonalSegment(a: Point, b: Point): boolean {
  return a.x === b.x || a.y === b.y;
}

export function isZeroLengthSegment(a: Point, b: Point): boolean {
  return pointsEqual(a, b);
}

/**
 * Computes the required fourth corner for an axis-aligned rectangle draft.
 * Expects exactly three points in draw order.
 */
export function getRectangleClosingPoint(points: Point[]): Point | null {
  if (points.length !== 3) return null;

  const [a, b, c] = points;

  if (!isOrthogonalSegment(a, b) || !isOrthogonalSegment(b, c)) return null;
  if (isZeroLengthSegment(a, b) || isZeroLengthSegment(b, c)) return null;
  if (a.x === c.x || a.y === c.y) return null;

  const candidate1: Point = { x: a.x, y: c.y };
  const candidate2: Point = { x: c.x, y: a.y };

  if (pointsEqual(b, candidate1)) return candidate2;
  if (pointsEqual(b, candidate2)) return candidate1;

  return null;
}
