import type { CameraState, ScreenPoint, ViewportSize } from "@/lib/editor/types";
import { MAX_PIXELS_PER_MM, MIN_PIXELS_PER_MM } from "@/lib/editor/constants";
import { normalizeCanvasRotationDegrees } from "@/lib/editor/canvasRotation";

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
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const radians = (normalizeCanvasRotationDegrees(camera.rotationDegrees) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = (worldMm.x - camera.xMm) * camera.pixelsPerMm;
  const offsetY = (worldMm.y - camera.yMm) * camera.pixelsPerMm;

  return {
    x: offsetX * cos - offsetY * sin + centerX,
    y: offsetX * sin + offsetY * cos + centerY,
  };
}

export function screenToWorld(
  screenPx: ScreenPoint,
  camera: CameraState,
  viewport: ViewportSize
): ScreenPoint {
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const radians = (-normalizeCanvasRotationDegrees(camera.rotationDegrees) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = screenPx.x - centerX;
  const offsetY = screenPx.y - centerY;
  const rotatedOffsetX = offsetX * cos - offsetY * sin;
  const rotatedOffsetY = offsetX * sin + offsetY * cos;

  return {
    x: rotatedOffsetX / camera.pixelsPerMm + camera.xMm,
    y: rotatedOffsetY / camera.pixelsPerMm + camera.yMm,
  };
}

export function panCameraByScreenDelta(
  camera: CameraState,
  deltaPx: ScreenPoint
): CameraState {
  const radians = (-normalizeCanvasRotationDegrees(camera.rotationDegrees) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotatedDeltaX = deltaPx.x * cos - deltaPx.y * sin;
  const rotatedDeltaY = deltaPx.x * sin + deltaPx.y * cos;

  return {
    ...camera,
    xMm: camera.xMm - rotatedDeltaX / camera.pixelsPerMm,
    yMm: camera.yMm - rotatedDeltaY / camera.pixelsPerMm,
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
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const radians = (-normalizeCanvasRotationDegrees(camera.rotationDegrees) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = screenPoint.x - centerX;
  const offsetY = screenPoint.y - centerY;
  const rotatedOffsetX = offsetX * cos - offsetY * sin;
  const rotatedOffsetY = offsetX * sin + offsetY * cos;

  return {
    xMm: worldUnderCursor.x - rotatedOffsetX / clampedPixelsPerMm,
    yMm: worldUnderCursor.y - rotatedOffsetY / clampedPixelsPerMm,
    pixelsPerMm: clampedPixelsPerMm,
    rotationDegrees: normalizeCanvasRotationDegrees(camera.rotationDegrees),
  };
}
