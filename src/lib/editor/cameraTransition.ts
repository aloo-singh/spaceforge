import type { CameraState } from "@/lib/editor/types";
import {
  getShortestCanvasRotationDeltaDegrees,
  normalizeCanvasRotationDegrees,
} from "@/lib/editor/canvasRotation";

export const RESET_CAMERA_TRANSITION_DURATION_MS = 240;

export function easeResetCameraTransition(progress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  // A short ease-out keeps navigation confident: quick response up front, soft settle at the end.
  return 1 - (1 - clampedProgress) ** 3;
}

export function interpolateCamera(
  fromCamera: CameraState,
  toCamera: CameraState,
  progress: number
): CameraState {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return {
    xMm: fromCamera.xMm + (toCamera.xMm - fromCamera.xMm) * clampedProgress,
    yMm: fromCamera.yMm + (toCamera.yMm - fromCamera.yMm) * clampedProgress,
    pixelsPerMm:
      fromCamera.pixelsPerMm + (toCamera.pixelsPerMm - fromCamera.pixelsPerMm) * clampedProgress,
    rotationDegrees: normalizeCanvasRotationDegrees(
      fromCamera.rotationDegrees +
        getShortestCanvasRotationDeltaDegrees(
          fromCamera.rotationDegrees,
          toCamera.rotationDegrees
        ) *
          clampedProgress
    ),
  };
}
