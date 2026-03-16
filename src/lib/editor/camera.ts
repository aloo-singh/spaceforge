import type { CameraState, ScreenPoint, ViewportSize } from "@/lib/editor/types";
import { MAX_PIXELS_PER_MM, MIN_PIXELS_PER_MM } from "@/lib/editor/constants";

export function clampPixelsPerMm(
  pixelsPerMm: number,
  minimumPixelsPerMm = MIN_PIXELS_PER_MM
): number {
  return Math.min(MAX_PIXELS_PER_MM, Math.max(minimumPixelsPerMm, pixelsPerMm));
}

export function worldToScreen(
  worldMm: ScreenPoint,
  camera: CameraState,
  viewport: ViewportSize
): ScreenPoint {
  return {
    x: (worldMm.x - camera.xMm) * camera.pixelsPerMm + viewport.width / 2,
    y: (worldMm.y - camera.yMm) * camera.pixelsPerMm + viewport.height / 2,
  };
}

export function screenToWorld(
  screenPx: ScreenPoint,
  camera: CameraState,
  viewport: ViewportSize
): ScreenPoint {
  return {
    x: (screenPx.x - viewport.width / 2) / camera.pixelsPerMm + camera.xMm,
    y: (screenPx.y - viewport.height / 2) / camera.pixelsPerMm + camera.yMm,
  };
}

export function panCameraByScreenDelta(
  camera: CameraState,
  deltaPx: ScreenPoint
): CameraState {
  return {
    ...camera,
    xMm: camera.xMm - deltaPx.x / camera.pixelsPerMm,
    yMm: camera.yMm - deltaPx.y / camera.pixelsPerMm,
  };
}

export function zoomCameraToScreenPoint(
  camera: CameraState,
  viewport: ViewportSize,
  screenPoint: ScreenPoint,
  nextPixelsPerMm: number,
  minimumPixelsPerMm = MIN_PIXELS_PER_MM
): CameraState {
  const clampedPixelsPerMm = clampPixelsPerMm(nextPixelsPerMm, minimumPixelsPerMm);
  const worldUnderCursor = screenToWorld(screenPoint, camera, viewport);

  return {
    xMm: worldUnderCursor.x - (screenPoint.x - viewport.width / 2) / clampedPixelsPerMm,
    yMm: worldUnderCursor.y - (screenPoint.y - viewport.height / 2) / clampedPixelsPerMm,
    pixelsPerMm: clampedPixelsPerMm,
  };
}
