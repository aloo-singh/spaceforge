import type { Point } from "@/lib/editor/types";
import { isSimplePolygon } from "@/lib/editor/roomGeometry";

export type OrthogonalSegmentAxis = "horizontal" | "vertical";

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

export function getOrthogonalSegmentAxis(
  start: Point,
  end: Point
): OrthogonalSegmentAxis | null {
  if (start.x === end.x && start.y !== end.y) return "vertical";
  if (start.y === end.y && start.x !== end.x) return "horizontal";
  return null;
}

export function stripConsecutiveDuplicatePoints(points: Point[]): Point[] {
  const normalized: Point[] = [];

  for (const point of points) {
    const previousPoint = normalized[normalized.length - 1];
    if (previousPoint && pointsEqual(previousPoint, point)) {
      continue;
    }

    normalized.push({ ...point });
  }

  return normalized;
}

export function normalizeDraftPointChain(points: Point[]): Point[] {
  return stripConsecutiveDuplicatePoints(points);
}

export function applyCandidatePointToDraftPath(points: Point[], nextPoint: Point): Point[] {
  const normalizedPoints = normalizeDraftPointChain(points);
  if (normalizedPoints.length === 0) return [{ ...nextPoint }];
  if (normalizedPoints.length === 1) {
    return normalizeDraftPointChain([...normalizedPoints, nextPoint]);
  }

  const previousPoint = normalizedPoints[normalizedPoints.length - 2];
  const currentPoint = normalizedPoints[normalizedPoints.length - 1];
  const previousAxis = getOrthogonalSegmentAxis(previousPoint, currentPoint);
  const nextAxis = getOrthogonalSegmentAxis(currentPoint, nextPoint);

  if (previousAxis && nextAxis && previousAxis === nextAxis) {
    return normalizeDraftPointChain([...normalizedPoints.slice(0, -1), nextPoint]);
  }

  return normalizeDraftPointChain([...normalizedPoints, nextPoint]);
}

export type DraftLoopClosureResult = {
  nextDraftPath: Point[];
  committedLoop: Point[];
  discardedPrefix: Point[];
};

export function getDraftLoopClosureResultFromPath(
  nextDraftPath: Point[]
): DraftLoopClosureResult | null {
  if (nextDraftPath.length < 5) return null;

  const closureCandidates = [
    getVertexDraftLoopClosureResult(nextDraftPath),
    getEndpointOnSegmentDraftLoopClosureResult(nextDraftPath),
    getSegmentIntersectionDraftLoopClosureResult(nextDraftPath),
  ].filter((candidate): candidate is DraftLoopClosureResult => candidate !== null);

  const distinctClosures = new Map<string, DraftLoopClosureResult>();
  for (const candidate of closureCandidates) {
    const key = candidate.committedLoop.map((point) => `${point.x}:${point.y}`).join("|");
    distinctClosures.set(key, candidate);
  }

  if (distinctClosures.size !== 1) return null;
  return [...distinctClosures.values()][0];
}

export function getDraftLoopClosureResult(
  points: Point[],
  nextPoint: Point
): DraftLoopClosureResult | null {
  return getDraftLoopClosureResultFromPath(applyCandidatePointToDraftPath(points, nextPoint));
}

export function getDraftLoopCandidate(points: Point[], nextPoint: Point): Point[] | null {
  return getDraftLoopClosureResult(points, nextPoint)?.committedLoop ?? null;
}

function getVertexDraftLoopClosureResult(nextDraftPath: Point[]): DraftLoopClosureResult | null {
  const loopEndpoint = nextDraftPath[nextDraftPath.length - 1];
  const validLoopStartIndices: number[] = [];

  for (let index = 0; index < nextDraftPath.length - 1; index += 1) {
    if (!pointsEqual(nextDraftPath[index], loopEndpoint)) continue;

    const candidate = nextDraftPath.slice(index, -1);
    if (!isValidCommittedDraftLoop(candidate)) continue;

    validLoopStartIndices.push(index);
    if (validLoopStartIndices.length > 1) {
      return null;
    }
  }

  const loopStartIndex = validLoopStartIndices[0];
  if (loopStartIndex === undefined) return null;

  return {
    nextDraftPath,
    committedLoop: nextDraftPath.slice(loopStartIndex, -1),
    discardedPrefix: nextDraftPath.slice(0, loopStartIndex),
  };
}

function getEndpointOnSegmentDraftLoopClosureResult(
  nextDraftPath: Point[]
): DraftLoopClosureResult | null {
  const loopEndpoint = nextDraftPath[nextDraftPath.length - 1];
  const terminalStartIndex = nextDraftPath.length - 2;
  const validClosures: DraftLoopClosureResult[] = [];

  for (let segmentStartIndex = 0; segmentStartIndex < terminalStartIndex - 1; segmentStartIndex += 1) {
    const segmentStart = nextDraftPath[segmentStartIndex];
    const segmentEnd = nextDraftPath[segmentStartIndex + 1];
    if (!isPointStrictlyInsideSupportedSegment(loopEndpoint, segmentStart, segmentEnd)) {
      continue;
    }

    const candidate = [loopEndpoint, ...nextDraftPath.slice(segmentStartIndex + 1, -1)];
    if (!isValidCommittedDraftLoop(candidate)) continue;

    validClosures.push({
      nextDraftPath,
      committedLoop: candidate,
      discardedPrefix: nextDraftPath.slice(0, segmentStartIndex + 1),
    });
    if (validClosures.length > 1) {
      return null;
    }
  }

  return validClosures[0] ?? null;
}

function getSegmentIntersectionDraftLoopClosureResult(
  nextDraftPath: Point[]
): DraftLoopClosureResult | null {
  const terminalStartIndex = nextDraftPath.length - 2;
  const terminalStart = nextDraftPath[terminalStartIndex];
  const terminalEnd = nextDraftPath[terminalStartIndex + 1];
  const validClosures: DraftLoopClosureResult[] = [];

  for (let segmentStartIndex = 0; segmentStartIndex < terminalStartIndex - 1; segmentStartIndex += 1) {
    const segmentStart = nextDraftPath[segmentStartIndex];
    const segmentEnd = nextDraftPath[segmentStartIndex + 1];
    const intersectionPoint = getStrictSupportedSegmentIntersectionPoint(
      segmentStart,
      segmentEnd,
      terminalStart,
      terminalEnd
    );
    if (!intersectionPoint) continue;

    const candidate = [intersectionPoint, ...nextDraftPath.slice(segmentStartIndex + 1, -1)];
    if (!isValidCommittedDraftLoop(candidate)) continue;

    validClosures.push({
      nextDraftPath,
      committedLoop: candidate,
      discardedPrefix: nextDraftPath.slice(0, segmentStartIndex + 1),
    });
    if (validClosures.length > 1) {
      return null;
    }
  }

  return validClosures[0] ?? null;
}

function isValidCommittedDraftLoop(points: Point[]): boolean {
  if (points.length < 4) return false;
  return isSupportedDrawPointPath(points, { closed: true }) && isSimplePolygon(points);
}

function getStrictSupportedSegmentIntersectionPoint(
  aStart: Point,
  aEnd: Point,
  bStart: Point,
  bEnd: Point
): Point | null {
  const aDirection = getSupportedDrawSegmentDirection(aStart, aEnd);
  const bDirection = getSupportedDrawSegmentDirection(bStart, bEnd);
  if (!aDirection || !bDirection || aDirection === bDirection) return null;

  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;
  const denominator = aDx * bDy - aDy * bDx;
  if (denominator === 0) return null;

  const tNumerator = (bStart.x - aStart.x) * bDy - (bStart.y - aStart.y) * bDx;
  const intersectionPoint = {
    x: aStart.x + (tNumerator * aDx) / denominator,
    y: aStart.y + (tNumerator * aDy) / denominator,
  };

  if (
    !Number.isFinite(intersectionPoint.x) ||
    !Number.isFinite(intersectionPoint.y) ||
    !isPointStrictlyInsideSupportedSegment(intersectionPoint, aStart, aEnd) ||
    !isPointStrictlyInsideSupportedSegment(intersectionPoint, bStart, bEnd)
  ) {
    return null;
  }

  return intersectionPoint;
}

function isPointStrictlyInsideSupportedSegment(point: Point, start: Point, end: Point): boolean {
  if (!getSupportedDrawSegmentDirection(start, end)) return false;
  if (!isPointOnSupportedSegment(point, start, end)) return false;

  return (
    !pointsEqual(point, start) &&
    !pointsEqual(point, end)
  );
}

function isPointOnSupportedSegment(point: Point, start: Point, end: Point): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (cross !== 0) return false;

  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}

function getSupportedDrawSegmentDirection(
  start: Point,
  end: Point
): "horizontal" | "vertical" | "diagonal-positive" | "diagonal-negative" | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return null;
  if (dy === 0) return "horizontal";
  if (dx === 0) return "vertical";
  if (Math.abs(dx) !== Math.abs(dy)) return null;
  return dx * dy > 0 ? "diagonal-positive" : "diagonal-negative";
}

function isSupportedDrawPointPath(points: Point[], options?: { closed?: boolean }): boolean {
  const segmentCount = options?.closed ? points.length : points.length - 1;
  if (segmentCount < 1) return false;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!getSupportedDrawSegmentDirection(start, end)) {
      return false;
    }
  }

  return true;
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
