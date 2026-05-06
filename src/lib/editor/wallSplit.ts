import { worldToScreen } from "@/lib/editor/camera";
import { snapToGrid } from "@/lib/editor/geometry";
import { isSimplePolygon } from "@/lib/editor/roomGeometry";
import { getRoomWallSegment } from "@/lib/editor/openings";
import { isSupportedDrawPointPath } from "@/lib/editor/snapping";
import type { CameraState, Point, Room, RoomWall, ScreenPoint, ViewportSize } from "@/lib/editor/types";

export const WALL_SPLIT_GRID_SIZE_MM = 100;
export const WALL_SPLIT_INITIAL_JOG_MM = 100;
export const WALL_SPLIT_HANDLE_RADIUS_PX = 9;
export const WALL_SPLIT_HANDLE_HIT_RADIUS_PX = 16;
export const WALL_SPLIT_HANDLE_OFFSET_PX = 20;
export const WALL_SPLIT_TOOLTIP_GAP_PX = 8;

const WALL_SPLIT_POINT_TOLERANCE_MM = 4;
const WALL_SPLIT_SCREEN_HIT_PADDING_PX = 12;

export type WallSplitResult = {
  wallIndex: number;
  splitOffsetMm: number;
  splitPoint: Point;
  interiorNormal: Point;
  previousPoints: Point[];
  nextPoints: Point[];
  cornerVertexIndex: number;
};

export function getWallSplitHandleLayout(
  room: Room,
  wall: RoomWall,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<{ wallMeasurementPosition: "inside" | "outside" }, "wallMeasurementPosition">
): { center: ScreenPoint; tooltipCenter: ScreenPoint; splitPoint: Point } | null {
  const segment = getRoomWallSegment(room, wall);
  if (!segment || segment.axis === "diagonal") return null;

  const splitPoint = {
    x: (segment.originalStart.x + segment.originalEnd.x) / 2,
    y: (segment.originalStart.y + segment.originalEnd.y) / 2,
  };
  const midpoint = worldToScreen(splitPoint, camera, viewport);
  const normalAnchor = worldToScreen(
    {
      x: splitPoint.x + segment.interiorNormal.x * 100,
      y: splitPoint.y + segment.interiorNormal.y * 100,
    },
    camera,
    viewport
  );
  const normal = normalizeScreenDirection({
    x: normalAnchor.x - midpoint.x,
    y: normalAnchor.y - midpoint.y,
  });
  const placementDirection =
    settings.wallMeasurementPosition === "inside"
      ? {
          x: -normal.x,
          y: -normal.y,
        }
      : normal;
  const center = {
    x: midpoint.x + placementDirection.x * WALL_SPLIT_HANDLE_OFFSET_PX,
    y: midpoint.y + placementDirection.y * WALL_SPLIT_HANDLE_OFFSET_PX,
  };

  return {
    center,
    splitPoint,
    tooltipCenter: {
      x:
        center.x +
        placementDirection.x * (WALL_SPLIT_HANDLE_RADIUS_PX + WALL_SPLIT_TOOLTIP_GAP_PX),
      y:
        center.y +
        placementDirection.y * (WALL_SPLIT_HANDLE_RADIUS_PX + WALL_SPLIT_TOOLTIP_GAP_PX),
    },
  };
}

export function hitTestWallSplitHandle(center: ScreenPoint, screenPoint: ScreenPoint): boolean {
  const distanceSquared = (screenPoint.x - center.x) ** 2 + (screenPoint.y - center.y) ** 2;
  return distanceSquared <= WALL_SPLIT_HANDLE_HIT_RADIUS_PX ** 2;
}

export function getWallSplitPointAtScreenPoint(
  room: Room,
  screenPoint: ScreenPoint,
  camera: CameraState,
  viewport: ViewportSize
): Point | null {
  for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
    const segment = getRoomWallSegment(room, wallIndex);
    if (!segment || segment.axis === "diagonal" || segment.lengthMm <= WALL_SPLIT_GRID_SIZE_MM * 2) {
      continue;
    }

    const start = worldToScreen(segment.originalStart, camera, viewport);
    const end = worldToScreen(segment.originalEnd, camera, viewport);
    const hit = getProjectedScreenPointOnSegment(screenPoint, start, end);
    if (!hit || hit.distancePx > WALL_SPLIT_SCREEN_HIT_PADDING_PX) continue;
    if (
      hit.offsetRatio * segment.lengthMm < WALL_SPLIT_GRID_SIZE_MM ||
      (1 - hit.offsetRatio) * segment.lengthMm < WALL_SPLIT_GRID_SIZE_MM
    ) {
      continue;
    }

    return {
      x: segment.originalStart.x + (segment.originalEnd.x - segment.originalStart.x) * hit.offsetRatio,
      y: segment.originalStart.y + (segment.originalEnd.y - segment.originalStart.y) * hit.offsetRatio,
    };
  }

  return null;
}

export function getWallSplitResult(room: Room, worldPoint: Point): WallSplitResult | null {
  const target = getWallSplitTarget(room, worldPoint);
  if (!target) return null;

  return (
    getWallSplitResultForOffset(room, target.wallIndex, target.splitOffsetMm, target.splitPoint, 1) ??
    getWallSplitResultForOffset(room, target.wallIndex, target.splitOffsetMm, target.splitPoint, -1)
  );
}

function getProjectedScreenPointOnSegment(
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint
): { distancePx: number; offsetRatio: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.001) return null;

  const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  if (rawT < 0 || rawT > 1) return null;

  const projected = {
    x: start.x + dx * rawT,
    y: start.y + dy * rawT,
  };

  return {
    distancePx: Math.hypot(point.x - projected.x, point.y - projected.y),
    offsetRatio: rawT,
  };
}

export function getWallSplitDragPoints(
  split: Pick<WallSplitResult, "wallIndex" | "splitPoint" | "interiorNormal" | "previousPoints">,
  cursorWorld: Point
): Point[] | null {
  const rawOffset =
    (cursorWorld.x - split.splitPoint.x) * split.interiorNormal.x +
    (cursorWorld.y - split.splitPoint.y) * split.interiorNormal.y;
  const snappedOffset = snapToGrid(rawOffset, WALL_SPLIT_GRID_SIZE_MM);
  const sign = snappedOffset < 0 ? -1 : 1;
  const offsetMagnitude = Math.max(Math.abs(snappedOffset), WALL_SPLIT_INITIAL_JOG_MM);

  return getWallSplitPoints(
    split.previousPoints,
    split.wallIndex,
    split.splitPoint,
    {
      x: split.interiorNormal.x * sign * offsetMagnitude,
      y: split.interiorNormal.y * sign * offsetMagnitude,
    }
  )?.points ?? null;
}

export function getCleanWallSplitCommitPoints(
  split: WallSplitResult,
  points: Point[]
): Point[] {
  if (!isSupportedDrawPointPath(points, { closed: true }) || !isSimplePolygon(points)) {
    return split.previousPoints.map((point) => ({ ...point }));
  }

  if (hasShortSplitCornerSegment(split, points)) {
    return split.previousPoints.map((point) => ({ ...point }));
  }

  const cleanedPoints = removeCollinearPoints(points);
  if (
    cleanedPoints.length >= 4 &&
    isSupportedDrawPointPath(cleanedPoints, { closed: true }) &&
    isSimplePolygon(cleanedPoints)
  ) {
    return cleanedPoints;
  }

  return points.map((point) => ({ ...point }));
}

function getWallSplitTarget(
  room: Room,
  worldPoint: Point
): { wallIndex: number; splitOffsetMm: number; splitPoint: Point } | null {
  for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
    const segment = getRoomWallSegment(room, wallIndex);
    if (!segment || segment.axis === "diagonal" || segment.lengthMm <= WALL_SPLIT_GRID_SIZE_MM * 2) {
      continue;
    }

    const offsetMm = getWallOffsetMm(segment.originalStart, segment.originalEnd, worldPoint);
    if (offsetMm < 0 || offsetMm > segment.lengthMm) continue;

    const projectedPoint = getPointAtWallOffset(segment.originalStart, segment.originalEnd, offsetMm);
    const distanceMm = Math.hypot(worldPoint.x - projectedPoint.x, worldPoint.y - projectedPoint.y);
    if (distanceMm > WALL_SPLIT_POINT_TOLERANCE_MM) continue;

    const snappedOffsetMm = snapToGrid(offsetMm, WALL_SPLIT_GRID_SIZE_MM);
    if (
      snappedOffsetMm < WALL_SPLIT_GRID_SIZE_MM ||
      segment.lengthMm - snappedOffsetMm < WALL_SPLIT_GRID_SIZE_MM
    ) {
      return null;
    }

    return {
      wallIndex,
      splitOffsetMm: snappedOffsetMm,
      splitPoint: getPointAtWallOffset(segment.originalStart, segment.originalEnd, snappedOffsetMm),
    };
  }

  return null;
}

function getWallSplitResultForOffset(
  room: Room,
  wallIndex: number,
  splitOffsetMm: number,
  splitPoint: Point,
  normalSign: 1 | -1
): WallSplitResult | null {
  const segment = getRoomWallSegment(room, wallIndex);
  if (!segment || segment.axis === "diagonal") return null;
  const offset = {
    x: segment.interiorNormal.x * normalSign * WALL_SPLIT_INITIAL_JOG_MM,
    y: segment.interiorNormal.y * normalSign * WALL_SPLIT_INITIAL_JOG_MM,
  };
  const splitPoints = getWallSplitPoints(room.points, wallIndex, splitPoint, offset);
  if (!splitPoints) return null;

  return {
    wallIndex,
    splitOffsetMm,
    splitPoint,
    interiorNormal: segment.interiorNormal,
    previousPoints: room.points.map((point) => ({ ...point })),
    nextPoints: splitPoints.points,
    cornerVertexIndex: splitPoints.cornerVertexIndex,
  };
}

function getWallSplitPoints(
  points: Point[],
  wallIndex: number,
  splitPoint: Point,
  offset: Point
): { points: Point[]; cornerVertexIndex: number } | null {
  if (points.length < 4) return null;

  const pointCount = points.length;
  const endIndex = (wallIndex + 1) % pointCount;
  const shiftedEnd = {
    x: points[endIndex].x + offset.x,
    y: points[endIndex].y + offset.y,
  };
  const corner = {
    x: splitPoint.x + offset.x,
    y: splitPoint.y + offset.y,
  };
  const splitStart = { ...splitPoint };
  const nextPoints =
    endIndex === 0
      ? [
          shiftedEnd,
          ...points.slice(1, wallIndex + 1).map((point) => ({ ...point })),
          splitStart,
          corner,
        ]
      : [
          ...points.slice(0, wallIndex + 1).map((point) => ({ ...point })),
          splitStart,
          corner,
          shiftedEnd,
          ...points.slice(endIndex + 1).map((point) => ({ ...point })),
        ];
  const cornerVertexIndex = endIndex === 0 ? pointCount + 1 : wallIndex + 2;

  if (!isSupportedDrawPointPath(nextPoints, { closed: true })) return null;
  if (!isSimplePolygon(nextPoints)) return null;

  return { points: nextPoints, cornerVertexIndex };
}

function hasShortSplitCornerSegment(split: WallSplitResult, points: Point[]): boolean {
  if (points.length !== split.nextPoints.length) return false;

  const cornerIndex = split.cornerVertexIndex;
  const pointCount = points.length;
  if (cornerIndex < 0 || cornerIndex >= pointCount) return true;

  const previousIndex = (cornerIndex - 1 + pointCount) % pointCount;
  const nextIndex = (cornerIndex + 1) % pointCount;

  return (
    getDistance(points[previousIndex], points[cornerIndex]) < WALL_SPLIT_GRID_SIZE_MM ||
    getDistance(points[cornerIndex], points[nextIndex]) < WALL_SPLIT_GRID_SIZE_MM
  );
}

function removeCollinearPoints(points: Point[]): Point[] {
  const cleaned: Point[] = [];

  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    cleaned.push({ ...point });
  }

  let changed = true;
  while (changed && cleaned.length > 4) {
    changed = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length];
      const current = cleaned[index];
      const next = cleaned[(index + 1) % cleaned.length];

      if (!arePointsCollinear(previous, current, next)) continue;
      cleaned.splice(index, 1);
      changed = true;
      break;
    }
  }

  return cleaned;
}

function arePointsCollinear(a: Point, b: Point, c: Point): boolean {
  return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
}

function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getWallOffsetMm(start: Point, end: Point, point: Point): number {
  const wallDelta = { x: end.x - start.x, y: end.y - start.y };
  const lengthMm = Math.hypot(wallDelta.x, wallDelta.y);
  if (lengthMm < 0.001) return 0;

  return ((point.x - start.x) * wallDelta.x + (point.y - start.y) * wallDelta.y) / lengthMm;
}

function getPointAtWallOffset(start: Point, end: Point, offsetMm: number): Point {
  const wallDelta = { x: end.x - start.x, y: end.y - start.y };
  const lengthMm = Math.max(Math.hypot(wallDelta.x, wallDelta.y), 0.001);
  const t = offsetMm / lengthMm;

  return {
    x: start.x + wallDelta.x * t,
    y: start.y + wallDelta.y * t,
  };
}

function normalizeScreenDirection(vector: ScreenPoint): ScreenPoint {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) {
    return { x: 0, y: -1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}
