import { clampPixelsPerMm } from "@/lib/editor/camera";
import type { LayoutBounds2d } from "@/lib/editor/exportLayoutBounds";
import type { CameraState, ViewportSize } from "@/lib/editor/types";

const DEFAULT_INNER_PADDING_PX = 72;

export type AutoFitExportFraming = {
  camera: CameraState;
  viewport: ViewportSize;
  isAutoFitApplied: boolean;
};

export function getAutoFitExportFraming(options: {
  layoutBounds: LayoutBounds2d | null;
  viewport: ViewportSize;
  fallbackCamera: CameraState;
  innerPaddingPx?: number;
}): AutoFitExportFraming {
  const viewport = {
    width: Math.max(1, Math.round(options.viewport.width)),
    height: Math.max(1, Math.round(options.viewport.height)),
  };
  const fallbackCamera = options.fallbackCamera;
  const layoutBounds = options.layoutBounds;
  const innerPaddingPx = Math.max(0, Math.round(options.innerPaddingPx ?? DEFAULT_INNER_PADDING_PX));

  if (!layoutBounds) {
    return {
      camera: fallbackCamera,
      viewport,
      isAutoFitApplied: false,
    };
  }

  const availableWidthPx = Math.max(1, viewport.width - innerPaddingPx * 2);
  const availableHeightPx = Math.max(1, viewport.height - innerPaddingPx * 2);
  const widthFitScale =
    layoutBounds.width > 0 ? availableWidthPx / layoutBounds.width : Number.POSITIVE_INFINITY;
  const heightFitScale =
    layoutBounds.height > 0 ? availableHeightPx / layoutBounds.height : Number.POSITIVE_INFINITY;
  const fitPixelsPerMm = Math.min(widthFitScale, heightFitScale);
  const pixelsPerMm = Number.isFinite(fitPixelsPerMm)
    ? clampPixelsPerMm(fitPixelsPerMm)
    : fallbackCamera.pixelsPerMm;

  return {
    camera: {
      xMm: layoutBounds.centerX,
      yMm: layoutBounds.centerY,
      pixelsPerMm,
    },
    viewport,
    isAutoFitApplied: true,
  };
}
