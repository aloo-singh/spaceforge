import type { Point, Room } from "@/lib/editor/types";

const DEFAULT_EPSILON = 1e-6;

function isPointOnSegment(point: Point, a: Point, b: Point, epsilon = DEFAULT_EPSILON): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon) return false;

  const minX = Math.min(a.x, b.x) - epsilon;
  const maxX = Math.max(a.x, b.x) + epsilon;
  const minY = Math.min(a.y, b.y) - epsilon;
  const maxY = Math.max(a.y, b.y) + epsilon;

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Ray-casting point-in-polygon test.
 * Returns true for points strictly inside and points on polygon edges.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];

    if (isPointOnSegment(point, a, b)) return true;

    const intersects =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Returns the top-most room hit at a point (last room drawn wins).
 */
export function findRoomAtPoint(rooms: Room[], point: Point): Room | null {
  for (let i = rooms.length - 1; i >= 0; i -= 1) {
    const room = rooms[i];
    if (room.points.length < 3) continue;
    if (isPointInPolygon(point, room.points)) return room;
  }

  return null;
}

/**
 * Polygon centroid suitable for simple room label anchoring.
 * Falls back to averaging vertices if polygon area is near zero.
 */
export function getPolygonLabelAnchor(points: Point[]): Point | null {
  if (points.length < 3) return null;

  let signedAreaTimesTwo = 0;
  let centroidXTimesSixArea = 0;
  let centroidYTimesSixArea = 0;

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const current = points[i];
    const previous = points[j];
    const cross = previous.x * current.y - current.x * previous.y;

    signedAreaTimesTwo += cross;
    centroidXTimesSixArea += (previous.x + current.x) * cross;
    centroidYTimesSixArea += (previous.y + current.y) * cross;
  }

  if (Math.abs(signedAreaTimesTwo) < DEFAULT_EPSILON) {
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }

  return {
    x: centroidXTimesSixArea / (3 * signedAreaTimesTwo),
    y: centroidYTimesSixArea / (3 * signedAreaTimesTwo),
  };
}
