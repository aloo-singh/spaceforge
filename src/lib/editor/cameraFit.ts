import type { LayoutBounds2d } from "@/lib/editor/exportLayoutBounds";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import { clampPixelsPerMm } from "@/lib/editor/camera";
import { MIN_PIXELS_PER_MM } from "@/lib/editor/constants";
import type { CameraState, Room, ViewportSize } from "@/lib/editor/types";

const DEFAULT_FIT_CAMERA_PADDING_PX = 96;
const MIN_FIT_CAMERA_SPAN_MM = 1200;
const DYNAMIC_MIN_ZOOM_HEADROOM = 0.92;

export type FitCameraResult = {
  camera: CameraState;
  didFitToRooms: boolean;
};

function getNormalizedViewport(viewport: ViewportSize): ViewportSize {
  return {
    width: Math.max(1, Math.round(viewport.width)),
    height: Math.max(1, Math.round(viewport.height)),
  };
}

function getNormalizedPaddingPx(paddingPx: number | undefined): number {
  return Math.max(0, Math.round(paddingPx ?? DEFAULT_FIT_CAMERA_PADDING_PX));
}

function getFitPixelsPerMmForBounds(options: {
  layoutBounds: LayoutBounds2d;
  viewport: ViewportSize;
  paddingPx: number;
}) {
  const paddedWidthMm = Math.max(options.layoutBounds.width, MIN_FIT_CAMERA_SPAN_MM);
  const paddedHeightMm = Math.max(options.layoutBounds.height, MIN_FIT_CAMERA_SPAN_MM);
  const availableWidthPx = Math.max(1, options.viewport.width - options.paddingPx * 2);
  const availableHeightPx = Math.max(1, options.viewport.height - options.paddingPx * 2);

  return Math.min(availableWidthPx / paddedWidthMm, availableHeightPx / paddedHeightMm);
}

export function getDrawingAwareMinPixelsPerMm(options: {
  layoutBounds: LayoutBounds2d | null;
  viewport: ViewportSize;
  paddingPx?: number;
  minimumPixelsPerMm?: number;
  zoomOutHeadroom?: number;
}): number {
  if (!options.layoutBounds) {
    return options.minimumPixelsPerMm ?? MIN_PIXELS_PER_MM;
  }

  const minimumPixelsPerMm = options.minimumPixelsPerMm ?? MIN_PIXELS_PER_MM;
  const fitPixelsPerMm = getFitPixelsPerMmForBounds({
    layoutBounds: options.layoutBounds,
    viewport: getNormalizedViewport(options.viewport),
    paddingPx: getNormalizedPaddingPx(options.paddingPx),
  });
  const zoomOutHeadroom = Math.max(0.1, Math.min(1, options.zoomOutHeadroom ?? DYNAMIC_MIN_ZOOM_HEADROOM));

  return Math.min(minimumPixelsPerMm, fitPixelsPerMm * zoomOutHeadroom);
}

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
  const viewport = getNormalizedViewport(options.viewport);
  const paddingPx = getNormalizedPaddingPx(options.paddingPx);

  if (!options.layoutBounds) {
    return {
      camera: { ...options.emptyLayoutCamera },
      didFitToRooms: false,
    };
  }

  const fitPixelsPerMm = getFitPixelsPerMmForBounds({
    layoutBounds: options.layoutBounds,
    viewport,
    paddingPx,
  });
  const minimumPixelsPerMm = getDrawingAwareMinPixelsPerMm({
    layoutBounds: options.layoutBounds,
    viewport,
    paddingPx,
  });

  return {
    camera: {
      xMm: options.layoutBounds.centerX,
      yMm: options.layoutBounds.centerY,
      pixelsPerMm: clampPixelsPerMm(fitPixelsPerMm, minimumPixelsPerMm),
    },
    didFitToRooms: true,
  };
}
