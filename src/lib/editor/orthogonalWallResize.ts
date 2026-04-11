import { worldToScreen } from "@/lib/editor/camera";
import { GRID_SIZE_MM } from "@/lib/editor/constants";
import { getRoomWallSegment } from "@/lib/editor/openings";
import { snapToGrid } from "@/lib/editor/geometry";
import {
  getSupportedDrawSegmentDirection,
  isSupportedDrawPointPath,
} from "@/lib/editor/snapping";
import { isSimplePolygon } from "@/lib/editor/roomGeometry";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";

export type OrthogonalWallHandleLayout = {
  wallIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
  length: number;
  thickness: number;
};

export type FortyFiveVertexHandleLayout = {
  vertexIndex: number;
  center: Point;
  size: number;
};

const HANDLE_LENGTH_PX = 40;
const HANDLE_THICKNESS_PX = 8;
const MIN_HANDLE_LENGTH_PX = 14;
const HANDLE_HIT_PADDING_PX = 8;
const VERTEX_HANDLE_SIZE_PX = 12;
const VERTEX_HANDLE_HIT_PADDING_PX = 8;
const ELIGIBILITY_NUDGE_DIRECTIONS: Point[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function getOrthogonalWallHandleLayouts(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize
): OrthogonalWallHandleLayout[] {
  if (room.points.length < 2) return [];

  const layouts: OrthogonalWallHandleLayout[] = [];

  for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
    const segment = getRoomWallSegment(room, wallIndex);
    if (!segment) continue;

    const start = worldToScreen(segment.originalStart, camera, viewport);
    const end = worldToScreen(segment.originalEnd, camera, viewport);
    const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
    const handleLength = clampHandleLength(lengthPx);
    const thickness = HANDLE_THICKNESS_PX;
    const center = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const tangent = normalizeVector({
      x: end.x - start.x,
      y: end.y - start.y,
    });
    const normal = {
      x: -tangent.y,
      y: tangent.x,
    };
    const halfLength = handleLength / 2;
    const halfThickness = thickness / 2;
    const corners = [
      {
        x: center.x - tangent.x * halfLength - normal.x * halfThickness,
        y: center.y - tangent.y * halfLength - normal.y * halfThickness,
      },
      {
        x: center.x + tangent.x * halfLength - normal.x * halfThickness,
        y: center.y + tangent.y * halfLength - normal.y * halfThickness,
      },
      {
        x: center.x + tangent.x * halfLength + normal.x * halfThickness,
        y: center.y + tangent.y * halfLength + normal.y * halfThickness,
      },
      {
        x: center.x - tangent.x * halfLength + normal.x * halfThickness,
        y: center.y - tangent.y * halfLength + normal.y * halfThickness,
      },
    ];
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);

    layouts.push({
      wallIndex,
      left: Math.min(...xs),
      top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      length: handleLength,
      thickness,
    });
  }

  return layouts;
}

export function hasDiagonalWallSegments(room: Room): boolean {
  if (room.points.length < 3) return false;

  for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
    const segment = getRoomWallSegment(room, wallIndex);
    if (segment?.axis === "diagonal") {
      return true;
    }
  }

  return false;
}

export function isNonRectangularEightWayRoom(room: Room): boolean {
  return (
    room.points.length >= 4 &&
    hasDiagonalWallSegments(room) &&
    isSupportedDrawPointPath(room.points, { closed: true }) &&
    isSimplePolygon(room.points)
  );
}

export function getFortyFiveVertexHandleLayouts(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize,
  options?: { gridSizeMm?: number }
): FortyFiveVertexHandleLayout[] {
  if (!isNonRectangularEightWayRoom(room)) return [];

  return getEligibleFortyFiveVertexIndices(room.points, options).map((vertexIndex) => ({
    vertexIndex,
    center: worldToScreen(room.points[vertexIndex], camera, viewport),
    size: VERTEX_HANDLE_SIZE_PX,
  }));
}

export function hitTestFortyFiveVertexHandle(
  handles: FortyFiveVertexHandleLayout[],
  point: Point
): number | null {
  for (const handle of handles) {
    const radius = handle.size / 2;
    const hitRadius = radius + VERTEX_HANDLE_HIT_PADDING_PX;
    const distanceSquared = (point.x - handle.center.x) ** 2 + (point.y - handle.center.y) ** 2;
    if (distanceSquared <= hitRadius ** 2) {
      return handle.vertexIndex;
    }
  }

  return null;
}

export function hitTestOrthogonalWallHandle(
  handles: OrthogonalWallHandleLayout[],
  point: Point
): number | null {
  for (const handle of handles) {
    if (
      point.x >= handle.left - HANDLE_HIT_PADDING_PX &&
      point.x <= handle.left + handle.width + HANDLE_HIT_PADDING_PX &&
      point.y >= handle.top - HANDLE_HIT_PADDING_PX &&
      point.y <= handle.top + handle.height + HANDLE_HIT_PADDING_PX
    ) {
      return handle.wallIndex;
    }
  }

  return null;
}

export function getOrthogonalWallAdjustmentResult(
  points: Point[],
  wallIndex: number,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): Point[] | null {
  if (points.length < 4) return null;

  const start = points[wallIndex];
  const end = points[(wallIndex + 1) % points.length];
  const direction = getSupportedDrawSegmentDirection(start, end);
  if (!direction) return null;

  if (direction === "diagonal-positive" || direction === "diagonal-negative") {
    return getDiagonalWallAdjustmentResult(points, wallIndex, cursorWorld);
  }

  const gridSizeMm = options?.gridSizeMm ?? GRID_SIZE_MM;
  const nextPoints = points.map((point) => ({ ...point }));
  const snappedX = gridSizeMm > 0 ? snapToGrid(cursorWorld.x, gridSizeMm) : cursorWorld.x;
  const snappedY = gridSizeMm > 0 ? snapToGrid(cursorWorld.y, gridSizeMm) : cursorWorld.y;

  if (direction === "horizontal") {
    nextPoints[wallIndex] = { ...start, y: snappedY };
    nextPoints[(wallIndex + 1) % points.length] = { ...end, y: snappedY };
  } else {
    nextPoints[wallIndex] = { ...start, x: snappedX };
    nextPoints[(wallIndex + 1) % points.length] = { ...end, x: snappedX };
  }

  if (!isSupportedDrawPointPath(nextPoints, { closed: true })) return null;
  if (!isSimplePolygon(nextPoints)) return null;

  return nextPoints;
}

export function getFortyFiveVertexAdjustmentResult(
  points: Point[],
  vertexIndex: number,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): Point[] | null {
  if (points.length < 4) return null;

  const gridSizeMm = options?.gridSizeMm ?? GRID_SIZE_MM;
  const movedVertex =
    gridSizeMm > 0
      ? {
          x: snapToGrid(cursorWorld.x, gridSizeMm),
          y: snapToGrid(cursorWorld.y, gridSizeMm),
        }
      : cursorWorld;
  const pointCount = points.length;
  const prevIndex = (vertexIndex - 1 + pointCount) % pointCount;
  const nextIndex = (vertexIndex + 1) % pointCount;
  const prevAnchorIndex = (vertexIndex - 2 + pointCount) % pointCount;
  const nextAnchorIndex = (vertexIndex + 2) % pointCount;
  const prevWallDirection = getSupportedDrawSegmentDirection(points[prevIndex], points[vertexIndex]);
  const nextWallDirection = getSupportedDrawSegmentDirection(points[vertexIndex], points[nextIndex]);
  const prevTravelDirection = getSupportedDrawSegmentDirection(
    points[prevAnchorIndex],
    points[prevIndex]
  );
  const nextTravelDirection = getSupportedDrawSegmentDirection(
    points[nextIndex],
    points[nextAnchorIndex]
  );
  if (!prevWallDirection || !nextWallDirection || !prevTravelDirection || !nextTravelDirection) {
    return null;
  }

  const nextPrevPoint = getLineIntersection(
    movedVertex,
    getDirectionVector(prevWallDirection),
    points[prevIndex],
    getDirectionVector(prevTravelDirection)
  );
  const nextNextPoint = getLineIntersection(
    movedVertex,
    getDirectionVector(nextWallDirection),
    points[nextIndex],
    getDirectionVector(nextTravelDirection)
  );
  if (!nextPrevPoint || !nextNextPoint) return null;

  const nextPoints = points.map((point) => ({ ...point }));
  nextPoints[vertexIndex] = movedVertex;
  nextPoints[prevIndex] = nextPrevPoint;
  nextPoints[nextIndex] = nextNextPoint;

  if (!isSupportedDrawPointPath(nextPoints, { closed: true })) return null;
  if (!isSimplePolygon(nextPoints)) return null;

  return nextPoints;
}

function clampHandleLength(lengthPx: number) {
  return Math.max(MIN_HANDLE_LENGTH_PX, Math.min(HANDLE_LENGTH_PX, lengthPx));
}

function getEligibleFortyFiveVertexIndices(
  points: Point[],
  options?: { gridSizeMm?: number }
): number[] {
  if (points.length < 4) return [];

  const gridSizeMm = options?.gridSizeMm ?? GRID_SIZE_MM;
  const eligible: number[] = [];

  for (let vertexIndex = 0; vertexIndex < points.length; vertexIndex += 1) {
    const origin = points[vertexIndex];
    let canAdjust = false;

    for (const direction of ELIGIBILITY_NUDGE_DIRECTIONS) {
      const candidate = {
        x: snapToGrid(origin.x + direction.x * gridSizeMm, gridSizeMm),
        y: snapToGrid(origin.y + direction.y * gridSizeMm, gridSizeMm),
      };
      if (candidate.x === origin.x && candidate.y === origin.y) continue;
      if (getFortyFiveVertexAdjustmentResult(points, vertexIndex, candidate, { gridSizeMm })) {
        canAdjust = true;
        break;
      }
    }

    if (canAdjust) {
      eligible.push(vertexIndex);
    }
  }

  return eligible;
}

function getDiagonalWallAdjustmentResult(
  points: Point[],
  wallIndex: number,
  cursorWorld: Point
): Point[] | null {
  if (points.length < 4) return null;

  const pointCount = points.length;
  const startIndex = wallIndex;
  const endIndex = (wallIndex + 1) % pointCount;
  const prevIndex = (wallIndex - 1 + pointCount) % pointCount;
  const nextIndex = (wallIndex + 2) % pointCount;
  const wallDirection = getSupportedDrawSegmentDirection(points[startIndex], points[endIndex]);
  const startTravelDirection = getSupportedDrawSegmentDirection(points[prevIndex], points[startIndex]);
  const endTravelDirection = getSupportedDrawSegmentDirection(points[endIndex], points[nextIndex]);
  if (!wallDirection || !startTravelDirection || !endTravelDirection) {
    return null;
  }

  const nextStart = getLineIntersection(
    cursorWorld,
    getDirectionVector(wallDirection),
    points[prevIndex],
    getDirectionVector(startTravelDirection)
  );
  const nextEnd = getLineIntersection(
    cursorWorld,
    getDirectionVector(wallDirection),
    points[nextIndex],
    getDirectionVector(endTravelDirection)
  );
  if (!nextStart || !nextEnd) return null;

  const nextPoints = points.map((point) => ({ ...point }));
  nextPoints[startIndex] = nextStart;
  nextPoints[endIndex] = nextEnd;

  if (!isSupportedDrawPointPath(nextPoints, { closed: true })) return null;
  if (!isSimplePolygon(nextPoints)) return null;

  return nextPoints;
}

function getDirectionVector(direction: ReturnType<typeof getSupportedDrawSegmentDirection>): Point {
  switch (direction) {
    case "horizontal":
      return { x: 1, y: 0 };
    case "vertical":
      return { x: 0, y: 1 };
    case "diagonal-positive":
      return { x: 1, y: 1 };
    case "diagonal-negative":
      return { x: 1, y: -1 };
    default:
      return { x: 0, y: 0 };
  }
}

function getLineIntersection(
  originA: Point,
  directionA: Point,
  originB: Point,
  directionB: Point
): Point | null {
  const denominator = cross(directionA, directionB);
  if (Math.abs(denominator) < 1e-6) return null;

  const delta = {
    x: originB.x - originA.x,
    y: originB.y - originA.y,
  };
  const t = cross(delta, directionB) / denominator;

  return {
    x: originA.x + directionA.x * t,
    y: originA.y + directionA.y * t,
  };
}

function cross(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function normalizeVector(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) {
    return { x: 1, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}
