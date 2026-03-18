import { GRID_SIZE_MM } from "@/lib/editor/constants";
import { getOrthogonalSegmentAxis, normalizeDraftPointChain, snapPointToGrid } from "@/lib/editor/geometry";
import {
  isAxisAlignedRectangle,
  isOrthogonalPointPath,
  isSimplePolygon,
} from "@/lib/editor/roomGeometry";
import { worldToScreen } from "@/lib/editor/camera";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";

export type ConstrainedVertexHandleLayout = {
  vertexIndex: number;
  center: Point;
  size: number;
};

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

export function isNonRectangularOrthogonalRoom(room: Room): boolean {
  return (
    room.points.length >= 4 &&
    isOrthogonalPointPath(room.points, { closed: true }) &&
    isSimplePolygon(room.points) &&
    !isAxisAlignedRectangle(room.points)
  );
}

export function getEligibleConstrainedVertexIndices(
  room: Room,
  options?: { gridSizeMm?: number }
): number[] {
  if (!isNonRectangularOrthogonalRoom(room)) return [];

  const gridSizeMm = options?.gridSizeMm ?? GRID_SIZE_MM;
  const eligibleIndices: number[] = [];

  for (let vertexIndex = 0; vertexIndex < room.points.length; vertexIndex += 1) {
    if (canConstrainedVertexBeAdjusted(room.points, vertexIndex, gridSizeMm)) {
      eligibleIndices.push(vertexIndex);
    }
  }

  return eligibleIndices;
}

export function getConstrainedVertexHandleLayouts(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize,
  options?: { gridSizeMm?: number }
): ConstrainedVertexHandleLayout[] {
  return getEligibleConstrainedVertexIndices(room, options).map((vertexIndex) => ({
    vertexIndex,
    center: worldToScreen(room.points[vertexIndex], camera, viewport),
    size: VERTEX_HANDLE_SIZE_PX,
  }));
}

export function hitTestConstrainedVertexHandle(
  handles: ConstrainedVertexHandleLayout[],
  point: Point
): number | null {
  for (const handle of handles) {
    const radius = handle.size / 2;
    const hitRadius = radius + VERTEX_HANDLE_HIT_PADDING_PX;
    const distanceSquared =
      (point.x - handle.center.x) ** 2 + (point.y - handle.center.y) ** 2;

    if (distanceSquared <= hitRadius ** 2) {
      return handle.vertexIndex;
    }
  }

  return null;
}

export function getConstrainedVertexAdjustmentResult(
  points: Point[],
  vertexIndex: number,
  nextPoint: Point
): Point[] | null {
  if (points.length < 4) return null;

  const pointCount = points.length;
  const prevIndex = (vertexIndex - 1 + pointCount) % pointCount;
  const nextIndex = (vertexIndex + 1) % pointCount;
  const prevAxis = getOrthogonalSegmentAxis(points[prevIndex], points[vertexIndex]);
  const nextAxis = getOrthogonalSegmentAxis(points[vertexIndex], points[nextIndex]);

  if (!prevAxis || !nextAxis || prevAxis === nextAxis) return null;

  const nextPoints = points.map((point) => ({ ...point }));
  nextPoints[vertexIndex] = { ...nextPoint };
  nextPoints[prevIndex] = alignPointToMovedVertex(points[prevIndex], nextPoint, prevAxis);
  nextPoints[nextIndex] = alignPointToMovedVertex(points[nextIndex], nextPoint, nextAxis);

  const normalizedPoints = normalizeDraftPointChain(nextPoints);
  if (normalizedPoints.length !== points.length) return null;
  if (!isOrthogonalPointPath(normalizedPoints, { closed: true })) return null;
  if (!isSimplePolygon(normalizedPoints)) return null;

  return normalizedPoints;
}

function canConstrainedVertexBeAdjusted(
  points: Point[],
  vertexIndex: number,
  gridSizeMm: number
): boolean {
  const origin = points[vertexIndex];

  for (const direction of ELIGIBILITY_NUDGE_DIRECTIONS) {
    const candidate = snapPointToGrid(
      {
        x: origin.x + direction.x * gridSizeMm,
        y: origin.y + direction.y * gridSizeMm,
      },
      gridSizeMm
    );

    if (candidate.x === origin.x && candidate.y === origin.y) continue;
    if (getConstrainedVertexAdjustmentResult(points, vertexIndex, candidate)) {
      return true;
    }
  }

  return false;
}

function alignPointToMovedVertex(
  point: Point,
  movedVertex: Point,
  axis: "horizontal" | "vertical"
): Point {
  if (axis === "horizontal") {
    return { x: point.x, y: movedVertex.y };
  }

  return { x: movedVertex.x, y: point.y };
}
