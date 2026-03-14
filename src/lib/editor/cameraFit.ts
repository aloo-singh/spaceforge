import type { LayoutBounds2d } from "@/lib/editor/exportLayoutBounds";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import { clampPixelsPerMm } from "@/lib/editor/camera";
import type { CameraState, Room, ViewportSize } from "@/lib/editor/types";

const DEFAULT_FIT_CAMERA_PADDING_PX = 96;
const MIN_FIT_CAMERA_SPAN_MM = 1200;

export type FitCameraResult = {
  camera: CameraState;
  didFitToRooms: boolean;
};

export function getCameraFitTarget(options: {
  rooms: Room[];
  viewport: ViewportSize;
  emptyLayoutCamera: CameraState;
  paddingPx?: number;
}): FitCameraResult {
  return getCameraFitTargetForBounds({
    layoutBounds: getLayoutBoundsFromRooms(options.rooms),
    viewport: options.viewport,
    emptyLayoutCamera: options.emptyLayoutCamera,
    paddingPx: options.paddingPx,
  });
}

export function getCameraFitTargetForBounds(options: {
  layoutBounds: LayoutBounds2d | null;
  viewport: ViewportSize;
  emptyLayoutCamera: CameraState;
  paddingPx?: number;
}): FitCameraResult {
  const viewport = {
    width: Math.max(1, Math.round(options.viewport.width)),
    height: Math.max(1, Math.round(options.viewport.height)),
  };
  const paddingPx = Math.max(0, Math.round(options.paddingPx ?? DEFAULT_FIT_CAMERA_PADDING_PX));

  if (!options.layoutBounds) {
    return {
      camera: { ...options.emptyLayoutCamera },
      didFitToRooms: false,
    };
  }

  const paddedWidthMm = Math.max(options.layoutBounds.width, MIN_FIT_CAMERA_SPAN_MM);
  const paddedHeightMm = Math.max(options.layoutBounds.height, MIN_FIT_CAMERA_SPAN_MM);
  const availableWidthPx = Math.max(1, viewport.width - paddingPx * 2);
  const availableHeightPx = Math.max(1, viewport.height - paddingPx * 2);
  const fitPixelsPerMm = Math.min(
    availableWidthPx / paddedWidthMm,
    availableHeightPx / paddedHeightMm
  );

  return {
    camera: {
      xMm: options.layoutBounds.centerX,
      yMm: options.layoutBounds.centerY,
      pixelsPerMm: clampPixelsPerMm(fitPixelsPerMm),
    },
    didFitToRooms: true,
  };
}
