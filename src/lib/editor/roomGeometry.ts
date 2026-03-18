import type { Point, Room } from "@/lib/editor/types";

const DEFAULT_EPSILON = 1e-6;
const LABEL_ANCHOR_SAMPLE_STEPS = 7;

export type PolygonBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

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

export function isSimplePolygon(points: Point[]): boolean {
  if (points.length < 3) return false;

  const segmentCount = points.length;

  for (let index = 0; index < segmentCount; index += 1) {
    const aStart = points[index];
    const aEnd = points[(index + 1) % segmentCount];

    for (let otherIndex = index + 1; otherIndex < segmentCount; otherIndex += 1) {
      const isSameSegment = index === otherIndex;
      const isAdjacentSegment =
        otherIndex === index + 1 || (index === 0 && otherIndex === segmentCount - 1);
      if (isSameSegment || isAdjacentSegment) continue;

      const bStart = points[otherIndex];
      const bEnd = points[(otherIndex + 1) % segmentCount];

      if (doSegmentsIntersect(aStart, aEnd, bStart, bEnd)) {
        return false;
      }
    }
  }

  return true;
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

export function getPolygonBounds(points: Point[]): PolygonBounds | null {
  if (points.length < 3) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function isOrthogonalPointPath(points: Point[], options?: { closed?: boolean }): boolean {
  const segmentCount = options?.closed ? points.length : points.length - 1;
  if (segmentCount < 1) return false;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const isOrthogonal = start.x === end.x || start.y === end.y;
    const isZeroLength = start.x === end.x && start.y === end.y;
    if (!isOrthogonal || isZeroLength) {
      return false;
    }
  }

  return true;
}

export function getAxisAlignedRectangleBounds(points: Point[]): PolygonBounds | null {
  if (points.length !== 4) return null;
  if (!isOrthogonalPointPath(points, { closed: true })) return null;

  const bounds = getPolygonBounds(points);
  if (!bounds) return null;

  const { minX, maxX, minY, maxY } = bounds;
  if (minX === maxX || minY === maxY) return null;

  const corners = new Set(points.map((point) => `${point.x}:${point.y}`));
  if (
    !corners.has(`${minX}:${minY}`) ||
    !corners.has(`${maxX}:${minY}`) ||
    !corners.has(`${maxX}:${maxY}`) ||
    !corners.has(`${minX}:${maxY}`)
  ) {
    return null;
  }

  return bounds;
}

export function isAxisAlignedRectangle(points: Point[]): boolean {
  return getAxisAlignedRectangleBounds(points) !== null;
}

export function getRectanglePointsFromBounds(bounds: PolygonBounds): Point[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

/**
 * Polygon centroid suitable for simple room label anchoring.
 * Falls back to averaging vertices if polygon area is near zero.
 */
export function getPolygonLabelAnchor(points: Point[]): Point | null {
  if (points.length < 3) return null;

  const centroid = getPolygonCentroid(points);
  if (centroid && isPointInPolygon(centroid, points)) {
    return centroid;
  }

  const fallbackAnchor = getInteriorSampleAnchor(points, centroid);
  if (fallbackAnchor) {
    return fallbackAnchor;
  }

  return centroid;
}

function getPolygonCentroid(points: Point[]): Point | null {
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

function getInteriorSampleAnchor(points: Point[], preferredPoint: Point | null): Point | null {
  const bounds = getPolygonBounds(points);
  if (!bounds) return null;

  const target = preferredPoint ?? {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };

  let bestCandidate: Point | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let row = 0; row <= LABEL_ANCHOR_SAMPLE_STEPS; row += 1) {
    const y = interpolateSample(bounds.minY, bounds.maxY, row);

    for (let column = 0; column <= LABEL_ANCHOR_SAMPLE_STEPS; column += 1) {
      const x = interpolateSample(bounds.minX, bounds.maxX, column);
      const candidate = { x, y };
      if (!isPointInPolygon(candidate, points)) continue;

      const distanceSquared = (candidate.x - target.x) ** 2 + (candidate.y - target.y) ** 2;
      if (distanceSquared < bestDistanceSquared) {
        bestCandidate = candidate;
        bestDistanceSquared = distanceSquared;
      }
    }
  }

  return bestCandidate;
}

function interpolateSample(min: number, max: number, step: number): number {
  if (max === min) return min;
  return min + ((step + 0.5) / (LABEL_ANCHOR_SAMPLE_STEPS + 1)) * (max - min);
}

function doSegmentsIntersect(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point): boolean {
  const aOrientationWithBStart = getOrientation(aStart, aEnd, bStart);
  const aOrientationWithBEnd = getOrientation(aStart, aEnd, bEnd);
  const bOrientationWithAStart = getOrientation(bStart, bEnd, aStart);
  const bOrientationWithAEnd = getOrientation(bStart, bEnd, aEnd);

  if (
    aOrientationWithBStart !== aOrientationWithBEnd &&
    bOrientationWithAStart !== bOrientationWithAEnd
  ) {
    return true;
  }

  if (aOrientationWithBStart === 0 && isPointOnSegment(bStart, aStart, aEnd)) return true;
  if (aOrientationWithBEnd === 0 && isPointOnSegment(bEnd, aStart, aEnd)) return true;
  if (bOrientationWithAStart === 0 && isPointOnSegment(aStart, bStart, bEnd)) return true;
  if (bOrientationWithAEnd === 0 && isPointOnSegment(aEnd, bStart, bEnd)) return true;

  return false;
}

function getOrientation(a: Point, b: Point, c: Point): -1 | 0 | 1 {
  const cross = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(cross) < DEFAULT_EPSILON) return 0;
  return cross > 0 ? 1 : -1;
}
