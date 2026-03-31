import type { CameraState, Point } from "@/lib/editor/types";
import { formatMetricWallDimension } from "@/lib/editor/measurements";
import type { EditorSettings } from "@/lib/editor/settings";

export const ADAPTIVE_SNAP_STEP_LARGE_MM = 1_000;
export const ADAPTIVE_SNAP_STEP_MEDIUM_MM = 500;
export const ADAPTIVE_SNAP_STEP_FINE_MM = 100;
const ADAPTIVE_SNAP_MEDIUM_ZOOM_THRESHOLD = 0.04;
const ADAPTIVE_SNAP_FINE_ZOOM_THRESHOLD = 0.1;
const SCALE_BAR_MAX_WIDTH_PX = 112;
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
