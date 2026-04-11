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
const GUIDE_EXTENSION_MM = 1_000_000;
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
  diagonalGuideSegments: SnapGuideSegment[];
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
  const verticalCandidates = new Map<number, AxisGuideSource[]>();
  const horizontalCandidates = new Map<number, AxisGuideSource[]>();
  const positiveDiagonalCandidates = new Set<number>();
  const negativeDiagonalCandidates = new Set<number>();
  const diagonalGuideCandidates: Point[] = [];
  const excludedRoomIds = options?.excludeRoomIds ?? EMPTY_EXCLUDED_ROOM_IDS;
  const constraintMode = options?.constraintMode ?? "orthogonal";

  for (const room of rooms) {
    if (excludedRoomIds.has(room.id)) continue;

    for (const point of room.points) {
      addAxisGuideSource(verticalCandidates, point.x, { axis: "vertical", point });
      addAxisGuideSource(horizontalCandidates, point.y, { axis: "horizontal", point });
      positiveDiagonalCandidates.add(point.x - point.y);
      negativeDiagonalCandidates.add(point.x + point.y);
      // Collect vertices for diagonal guidelines
      diagonalGuideCandidates.push(point);
    }

    for (let index = 0; index < room.points.length; index += 1) {
      const start = room.points[index];
      const end = room.points[(index + 1) % room.points.length];
      if (start.x === end.x) {
        addAxisGuideSource(verticalCandidates, start.x, {
          axis: "vertical",
          spanStart: Math.min(start.y, end.y),
          spanEnd: Math.max(start.y, end.y),
        });
      } else if (start.y === end.y) {
        addAxisGuideSource(horizontalCandidates, start.y, {
          axis: "horizontal",
          spanStart: Math.min(start.x, end.x),
          spanEnd: Math.max(start.x, end.x),
        });
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
    cursorWorld,
    camera.pixelsPerMm,
    "vertical"
  );
  const nearestHorizontal = getNearestAxisCandidateMm(
    horizontalCandidates,
    cursorWorld,
    camera.pixelsPerMm,
    "horizontal"
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

  // Find diagonal guide segments from vertices
  const diagonalGuideSegments: SnapGuideSegment[] = [];

  // Show diagonal guidelines when cursor is close to diagonal lines (same proximity rules as orthogonal)
  if (nearestPositiveDiagonal) {
    const constant = nearestPositiveDiagonal.constant;
    for (const vertex of diagonalGuideCandidates) {
      // Check if this vertex lies on the positive diagonal line that the cursor is close to
      if (Math.abs((vertex.x - vertex.y) - constant) < 0.1) {
        // Determine direction towards cursor along the diagonal line
        const dx = cursorWorld.x - vertex.x;
        // Extend towards the cursor: if cursor is to the right, extend right; if to the left, extend left
        const direction = dx >= 0 ? 1 : -1;

        // Show positive diagonal guideline from this vertex towards the cursor
        diagonalGuideSegments.push({
          start: vertex,
          end: {
            x: vertex.x + direction * GUIDE_EXTENSION_MM,
            y: vertex.y + direction * GUIDE_EXTENSION_MM,
          },
        });
      }
    }
  }

  if (nearestNegativeDiagonal) {
    const constant = nearestNegativeDiagonal.constant;
    for (const vertex of diagonalGuideCandidates) {
      // Check if this vertex lies on the negative diagonal line that the cursor is close to
      if (Math.abs((vertex.x + vertex.y) - constant) < 0.1) {
        // Determine direction towards cursor along the diagonal line
        const dx = cursorWorld.x - vertex.x;
        // Extend towards the cursor: if cursor is to the right, extend right; if to the left, extend left
        const direction = dx >= 0 ? 1 : -1;

        // Show negative diagonal guideline from this vertex towards the cursor
        diagonalGuideSegments.push({
          start: vertex,
          end: {
            x: vertex.x + direction * GUIDE_EXTENSION_MM,
            y: vertex.y - direction * GUIDE_EXTENSION_MM,
          },
        });
      }
    }
  }

  const point =
    constraintMode === "diagonal45" && nearestDiagonal
      ? nearestDiagonal.point
      : {
          x: nearestVertical?.coordinate ?? cursorWorld.x,
          y: nearestHorizontal?.coordinate ?? cursorWorld.y,
        };

  const segments: SnapGuideSegment[] = [];

  // Always show orthogonal guidelines
  if (nearestVertical !== null) {
    const segment = getAxisGuideSegment(nearestVertical, cursorWorld);
    if (segment) segments.push(segment);
  }

  if (nearestHorizontal !== null) {
    const segment = getAxisGuideSegment(nearestHorizontal, cursorWorld);
    if (segment) segments.push(segment);
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
    diagonalGuideSegments,
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
type AxisGuideSource =
  | { axis: "vertical"; point: Point }
  | { axis: "vertical"; spanStart: number; spanEnd: number }
  | { axis: "horizontal"; point: Point }
  | { axis: "horizontal"; spanStart: number; spanEnd: number };

type AxisGuideCandidate = {
  axis: "vertical" | "horizontal";
  coordinate: number;
  origin: Point;
  distancePx: number;
};

function projectOrthogonalPoint(anchor: Point, target: Point): Point {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: target.x, y: anchor.y };
  }

  return { x: anchor.x, y: target.y };
}

function getNearestAxisCandidateMm(
  candidates: Map<number, AxisGuideSource[]>,
  cursorWorld: Point,
  pixelsPerMm: number,
  axis: "vertical" | "horizontal"
): AxisGuideCandidate | null {
  let nearestCandidate: AxisGuideCandidate | null = null;
  let nearestDistancePx = Number.POSITIVE_INFINITY;

  for (const [coordinate, sources] of candidates) {
    const cursorCoordinateMm = axis === "vertical" ? cursorWorld.x : cursorWorld.y;
    const distancePx = Math.abs(coordinate - cursorCoordinateMm) * pixelsPerMm;
    if (distancePx > PREDICTIVE_GUIDELINE_THRESHOLD_PX || distancePx >= nearestDistancePx) {
      continue;
    }

    nearestCandidate = {
      axis,
      coordinate,
      origin: resolveAxisGuideOrigin(axis, coordinate, sources, cursorWorld),
      distancePx,
    };
    nearestDistancePx = distancePx;
  }

  return nearestCandidate;
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



function addAxisGuideSource(
  target: Map<number, AxisGuideSource[]>,
  coordinate: number,
  source: AxisGuideSource
) {
  const existing = target.get(coordinate);
  if (existing) {
    existing.push(source);
    return;
  }
  target.set(coordinate, [source]);
}

function resolveAxisGuideOrigin(
  axis: "vertical" | "horizontal",
  coordinate: number,
  sources: AxisGuideSource[],
  cursorWorld: Point
): Point {
  let nearestOrigin = getAxisGuideSourcePoint(axis, coordinate, sources[0], cursorWorld);
  let nearestDistance = getAxisOffsetDistance(axis, nearestOrigin, cursorWorld);

  for (let index = 1; index < sources.length; index += 1) {
    const candidateOrigin = getAxisGuideSourcePoint(axis, coordinate, sources[index], cursorWorld);
    const candidateDistance = getAxisOffsetDistance(axis, candidateOrigin, cursorWorld);
    if (candidateDistance >= nearestDistance) continue;
    nearestOrigin = candidateOrigin;
    nearestDistance = candidateDistance;
  }

  return nearestOrigin;
}

function getAxisGuideSourcePoint(
  axis: "vertical" | "horizontal",
  coordinate: number,
  source: AxisGuideSource,
  cursorWorld: Point
): Point {
  if ("point" in source) {
    return source.point;
  }

  if (axis === "vertical") {
    return {
      x: coordinate,
      y: clampValue(cursorWorld.y, source.spanStart, source.spanEnd),
    };
  }

  return {
    x: clampValue(cursorWorld.x, source.spanStart, source.spanEnd),
    y: coordinate,
  };
}

function getAxisGuideSegment(
  candidate: AxisGuideCandidate,
  cursorWorld: Point
): SnapGuideSegment | null {
  if (candidate.axis === "vertical") {
    const delta = cursorWorld.y - candidate.origin.y;
    if (delta === 0) return null;
    return {
      start: candidate.origin,
      end: {
        x: candidate.coordinate,
        y: candidate.origin.y + Math.sign(delta) * GUIDE_EXTENSION_MM,
      },
    };
  }

  const delta = cursorWorld.x - candidate.origin.x;
  if (delta === 0) return null;
  return {
    start: candidate.origin,
    end: {
      x: candidate.origin.x + Math.sign(delta) * GUIDE_EXTENSION_MM,
      y: candidate.coordinate,
    },
  };
}

function getAxisOffsetDistance(
  axis: "vertical" | "horizontal",
  point: Point,
  cursorWorld: Point
): number {
  return axis === "vertical"
    ? Math.abs(point.y - cursorWorld.y)
    : Math.abs(point.x - cursorWorld.x);
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

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
