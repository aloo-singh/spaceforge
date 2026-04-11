import { snapToGrid } from "@/lib/editor/geometry";
import type { CameraState, Point, Room } from "@/lib/editor/types";
import { formatMetricWallDimension } from "@/lib/editor/measurements";
import type { EditorSettings } from "@/lib/editor/settings";

export const ADAPTIVE_SNAP_STEP_LARGE_MM = 1_000;
export const ADAPTIVE_SNAP_STEP_MEDIUM_MM = 500;
export const ADAPTIVE_SNAP_STEP_FINE_MM = 100;
const ADAPTIVE_SNAP_MEDIUM_ZOOM_THRESHOLD = 0.04;
const ADAPTIVE_SNAP_FINE_ZOOM_THRESHOLD = 0.1;
const SCALE_BAR_MAX_WIDTH_PX = 112;
const PREDICTIVE_GUIDELINE_THRESHOLD_PX = 36;
const SHORT_GUIDELINE_TARGET_PX = 44;
const SCALE_BAR_WORLD_STEPS_MM = [
  100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000,
] as const;

export type DrawConstraintMode = "orthogonal" | "diagonal45";

export type SnapGuideSegment = {
  start: Point;
  end: Point;
};

export type SnapGuides = {
  point: Point;
  showVertical: boolean;
  showHorizontal: boolean;
  diagonalLine: { slope: 1 | -1; constant: number } | null;
  segments: SnapGuideSegment[];
  constraintMode: DrawConstraintMode;
};

export function getActiveSnapStepMm(camera: Pick<CameraState, "pixelsPerMm">): number {
  if (camera.pixelsPerMm >= ADAPTIVE_SNAP_FINE_ZOOM_THRESHOLD) {
    return ADAPTIVE_SNAP_STEP_FINE_MM;
  }

  if (camera.pixelsPerMm >= ADAPTIVE_SNAP_MEDIUM_ZOOM_THRESHOLD) {
    return ADAPTIVE_SNAP_STEP_MEDIUM_MM;
  }

  return ADAPTIVE_SNAP_STEP_LARGE_MM;
}

export function getSnapStepForSettings(
  camera: Pick<CameraState, "pixelsPerMm">,
  settings: Pick<EditorSettings, "snappingEnabled">
): number | null {
  return settings.snappingEnabled ? getActiveSnapStepMm(camera) : null;
}

export function getMagneticSnapGuidesForSettings(
  rooms: Room[],
  cursorWorld: Point,
  camera: Pick<CameraState, "pixelsPerMm">,
  settings: Pick<EditorSettings, "snappingEnabled">,
  options?: {
    excludeRoomIds?: Set<string>;
    constraintMode?: DrawConstraintMode;
    anchorPoint?: Point;
  }
): SnapGuides | null {
  if (!settings.snappingEnabled) return null;
  return getPredictiveSnapGuides(rooms, cursorWorld, camera, options);
}

export function getPredictiveSnapGuides(
  rooms: Room[],
  cursorWorld: Point,
  camera: Pick<CameraState, "pixelsPerMm">,
  options?: {
    excludeRoomIds?: Set<string>;
    constraintMode?: DrawConstraintMode;
    anchorPoint?: Point;
  }
): SnapGuides | null {
  const verticalCandidates = new Set<number>();
  const horizontalCandidates = new Set<number>();
  const positiveDiagonalCandidates = new Set<number>();
  const negativeDiagonalCandidates = new Set<number>();
  const excludedRoomIds = options?.excludeRoomIds ?? EMPTY_EXCLUDED_ROOM_IDS;
  const constraintMode = options?.constraintMode ?? "orthogonal";

  for (const room of rooms) {
    if (excludedRoomIds.has(room.id)) continue;

    for (const point of room.points) {
      verticalCandidates.add(point.x);
      horizontalCandidates.add(point.y);
      positiveDiagonalCandidates.add(point.x - point.y);
      negativeDiagonalCandidates.add(point.x + point.y);
    }

    for (let index = 0; index < room.points.length; index += 1) {
      const start = room.points[index];
      const end = room.points[(index + 1) % room.points.length];
      if (start.x === end.x) {
        verticalCandidates.add(start.x);
      } else if (start.y === end.y) {
        horizontalCandidates.add(start.y);
      } else if (Math.abs(end.x - start.x) === Math.abs(end.y - start.y)) {
        if ((end.x - start.x) * (end.y - start.y) > 0) {
          positiveDiagonalCandidates.add(start.x - start.y);
        } else {
          negativeDiagonalCandidates.add(start.x + start.y);
        }
      }
    }
  }

  const nearestVertical = getNearestAxisCandidateMm(
    verticalCandidates,
    cursorWorld.x,
    camera.pixelsPerMm
  );
  const nearestHorizontal = getNearestAxisCandidateMm(
    horizontalCandidates,
    cursorWorld.y,
    camera.pixelsPerMm
  );
  const nearestPositiveDiagonal = getNearestDiagonalCandidate(
    positiveDiagonalCandidates,
    cursorWorld,
    camera.pixelsPerMm,
    1
  );
  const nearestNegativeDiagonal = getNearestDiagonalCandidate(
    negativeDiagonalCandidates,
    cursorWorld,
    camera.pixelsPerMm,
    -1
  );
  const nearestDiagonal =
    nearestPositiveDiagonal === null
      ? nearestNegativeDiagonal
      : nearestNegativeDiagonal === null
        ? nearestPositiveDiagonal
        : nearestPositiveDiagonal.distancePx <= nearestNegativeDiagonal.distancePx
          ? nearestPositiveDiagonal
          : nearestNegativeDiagonal;

  const point =
    constraintMode === "diagonal45" && nearestDiagonal
      ? nearestDiagonal.point
      : {
          x: nearestVertical ?? cursorWorld.x,
          y: nearestHorizontal ?? cursorWorld.y,
        };

  const segments: SnapGuideSegment[] = [];
  if (constraintMode === "diagonal45" && nearestDiagonal) {
    segments.push({
      start: { x: cursorWorld.x, y: cursorWorld.y },
      end: nearestDiagonal.point,
    });
  } else {
    if (nearestVertical !== null) {
      segments.push({
        start: { x: cursorWorld.x, y: cursorWorld.y },
        end: { x: nearestVertical, y: cursorWorld.y },
      });
    }

    if (nearestHorizontal !== null) {
      segments.push({
        start: { x: cursorWorld.x, y: cursorWorld.y },
        end: { x: cursorWorld.x, y: nearestHorizontal },
      });
    }
  }

  if (options?.anchorPoint) {
    const constrainedPoint = getConstrainedDrawPoint(
      options.anchorPoint,
      point,
      getActiveSnapStepMm(camera),
      null,
      constraintMode
    );
    const alignmentSegment = getShortAlignmentGuideSegment(
      options.anchorPoint,
      constrainedPoint,
      camera.pixelsPerMm
    );
    if (alignmentSegment) {
      segments.push(alignmentSegment);
    }
  }

  if (
    nearestVertical === null &&
    nearestHorizontal === null &&
    nearestDiagonal === null &&
    segments.length === 0
  ) {
    return null;
  }

  return {
    point,
    showVertical: nearestVertical !== null,
    showHorizontal: nearestHorizontal !== null,
    diagonalLine:
      constraintMode === "diagonal45" && nearestDiagonal
        ? { slope: nearestDiagonal.slope, constant: nearestDiagonal.constant }
        : null,
    segments,
    constraintMode,
  };
}

export function getSnappedPointFromGuides(
  cursorWorld: Point,
  gridSizeMm: number,
  guides: SnapGuides | null
): Point {
  if (guides?.diagonalLine) {
    return guides.point;
  }

  return {
    x: guides?.showVertical ? guides.point.x : snapToGrid(cursorWorld.x, gridSizeMm),
    y: guides?.showHorizontal ? guides.point.y : snapToGrid(cursorWorld.y, gridSizeMm),
  };
}

export function getConstrainedDrawPoint(
  anchor: Point,
  cursorWorld: Point,
  gridSizeMm: number | null,
  guides: SnapGuides | null,
  mode: DrawConstraintMode
): Point {
  const resolvedCursor = gridSizeMm
    ? getSnappedPointFromGuides(cursorWorld, gridSizeMm, guides)
    : cursorWorld;

  if (mode === "diagonal45") {
    return projectEightWayPoint(anchor, resolvedCursor, gridSizeMm);
  }

  return projectOrthogonalPoint(anchor, resolvedCursor);
}

export function getSupportedDrawSegmentDirection(
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

export function isSupportedDrawPointPath(
  points: Point[],
  options?: { closed?: boolean }
): boolean {
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

export function getScaleOverlayState(camera: Pick<CameraState, "pixelsPerMm">): {
  widthPx: number;
  label: string;
} {
  const maxVisibleWorldMm = SCALE_BAR_MAX_WIDTH_PX / camera.pixelsPerMm;
  const resolvedWorldMm =
    [...SCALE_BAR_WORLD_STEPS_MM].reverse().find((stepMm) => stepMm <= maxVisibleWorldMm) ??
    SCALE_BAR_WORLD_STEPS_MM[0];

  return {
    widthPx: resolvedWorldMm * camera.pixelsPerMm,
    label: formatMetricWallDimension(resolvedWorldMm),
  };
}

const EMPTY_EXCLUDED_ROOM_IDS = new Set<string>();

function projectOrthogonalPoint(anchor: Point, target: Point): Point {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: target.x, y: anchor.y };
  }

  return { x: anchor.x, y: target.y };
}

function getNearestAxisCandidateMm(
  candidates: Set<number>,
  cursorCoordinateMm: number,
  pixelsPerMm: number
): number | null {
  let nearestCoordinate: number | null = null;
  let nearestDistancePx = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distancePx = Math.abs(candidate - cursorCoordinateMm) * pixelsPerMm;
    if (distancePx > PREDICTIVE_GUIDELINE_THRESHOLD_PX || distancePx >= nearestDistancePx) {
      continue;
    }

    nearestCoordinate = candidate;
    nearestDistancePx = distancePx;
  }

  return nearestCoordinate;
}

function getNearestDiagonalCandidate(
  candidates: Set<number>,
  cursorWorld: Point,
  pixelsPerMm: number,
  slope: 1 | -1
): { constant: number; distancePx: number; point: Point; slope: 1 | -1 } | null {
  let nearestCandidate: { constant: number; distancePx: number; point: Point; slope: 1 | -1 } | null =
    null;

  for (const constant of candidates) {
    const point =
      slope === 1
        ? projectPointToPositiveDiagonal(cursorWorld, constant)
        : projectPointToNegativeDiagonal(cursorWorld, constant);
    const distancePx =
      Math.hypot(point.x - cursorWorld.x, point.y - cursorWorld.y) * pixelsPerMm;
    if (
      distancePx > PREDICTIVE_GUIDELINE_THRESHOLD_PX ||
      (nearestCandidate !== null && distancePx >= nearestCandidate.distancePx)
    ) {
      continue;
    }

    nearestCandidate = { constant, distancePx, point, slope };
  }

  return nearestCandidate;
}

function projectEightWayPoint(
  anchor: Point,
  cursorWorld: Point,
  gridSizeMm: number | null
): Point {
  const dx = cursorWorld.x - anchor.x;
  const dy = cursorWorld.y - anchor.y;
  const octant = getNearestEightWayOctant(dx, dy);
  const horizontalCandidate = {
    x: anchor.x + snapMaybe(dx, gridSizeMm),
    y: anchor.y,
  };
  const verticalCandidate = {
    x: anchor.x,
    y: anchor.y + snapMaybe(dy, gridSizeMm),
  };
  const positiveMagnitude = snapMaybe((dx + dy) / 2, gridSizeMm);
  const negativeMagnitude = snapMaybe((dx - dy) / 2, gridSizeMm);
  const positiveCandidate = {
    x: anchor.x + positiveMagnitude,
    y: anchor.y + positiveMagnitude,
  };
  const negativeCandidate = {
    x: anchor.x + negativeMagnitude,
    y: anchor.y - negativeMagnitude,
  };

  if (octant === 0 || octant === 4) {
    return horizontalCandidate;
  }

  if (octant === 2 || octant === 6) {
    return verticalCandidate;
  }

  if (octant === 1 || octant === 5) {
    return positiveCandidate;
  }

  return negativeCandidate;
}

function getShortAlignmentGuideSegment(
  anchorPoint: Point,
  constrainedPoint: Point,
  pixelsPerMm: number
): SnapGuideSegment | null {
  const dx = constrainedPoint.x - anchorPoint.x;
  const dy = constrainedPoint.y - anchorPoint.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm <= 0) return null;

  const visibleLengthMm = Math.min(lengthMm, SHORT_GUIDELINE_TARGET_PX / pixelsPerMm);
  const unitX = dx / lengthMm;
  const unitY = dy / lengthMm;

  return {
    start: {
      x: constrainedPoint.x - unitX * visibleLengthMm,
      y: constrainedPoint.y - unitY * visibleLengthMm,
    },
    end: constrainedPoint,
  };
}

function projectPointToPositiveDiagonal(point: Point, constant: number): Point {
  return {
    x: (point.x + point.y + constant) / 2,
    y: (point.x + point.y - constant) / 2,
  };
}

function projectPointToNegativeDiagonal(point: Point, constant: number): Point {
  return {
    x: (point.x - point.y + constant) / 2,
    y: (-point.x + point.y + constant) / 2,
  };
}

function snapMaybe(value: number, gridSizeMm: number | null): number {
  return gridSizeMm ? snapToGrid(value, gridSizeMm) : value;
}

function getNearestEightWayOctant(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;

  const angle = Math.atan2(dy, dx);
  const octant = Math.round(angle / (Math.PI / 4));
  return ((octant % 8) + 8) % 8;
}
