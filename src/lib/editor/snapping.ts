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
const SCALE_BAR_WORLD_STEPS_MM = [
  100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000,
] as const;

export type SnapGuides = {
  point: Point;
  showVertical: boolean;
  showHorizontal: boolean;
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
  options?: { excludeRoomIds?: Set<string> }
): SnapGuides | null {
  if (!settings.snappingEnabled) return null;
  return getPredictiveSnapGuides(rooms, cursorWorld, camera, options);
}

export function getPredictiveSnapGuides(
  rooms: Room[],
  cursorWorld: Point,
  camera: Pick<CameraState, "pixelsPerMm">,
  options?: { excludeRoomIds?: Set<string> }
): SnapGuides | null {
  const verticalCandidates = new Set<number>();
  const horizontalCandidates = new Set<number>();
  const excludedRoomIds = options?.excludeRoomIds ?? EMPTY_EXCLUDED_ROOM_IDS;

  for (const room of rooms) {
    if (excludedRoomIds.has(room.id)) continue;

    for (const point of room.points) {
      verticalCandidates.add(point.x);
      horizontalCandidates.add(point.y);
    }

    for (let index = 0; index < room.points.length; index += 1) {
      const start = room.points[index];
      const end = room.points[(index + 1) % room.points.length];
      if (start.x === end.x) {
        verticalCandidates.add(start.x);
      } else if (start.y === end.y) {
        horizontalCandidates.add(start.y);
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
  if (nearestVertical === null && nearestHorizontal === null) return null;

  return {
    point: {
      x: nearestVertical ?? cursorWorld.x,
      y: nearestHorizontal ?? cursorWorld.y,
    },
    showVertical: nearestVertical !== null,
    showHorizontal: nearestHorizontal !== null,
  };
}

export function getSnappedPointFromGuides(
  cursorWorld: Point,
  gridSizeMm: number,
  guides: SnapGuides | null
): Point {
  return {
    x: guides?.showVertical ? guides.point.x : snapToGrid(cursorWorld.x, gridSizeMm),
    y: guides?.showHorizontal ? guides.point.y : snapToGrid(cursorWorld.y, gridSizeMm),
  };
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
