import type { LayoutBounds2d } from "@/lib/editor/exportLayoutBounds";
import type { CameraState, ViewportSize } from "@/lib/editor/types";
import { MIN_PIXELS_PER_MM } from "@/lib/editor/constants";
import { normalizeCanvasRotationDegrees } from "@/lib/editor/canvasRotation";

const DEFAULT_INNER_PADDING_PX = 72;
const DEFAULT_MAX_EXPORT_PIXELS_PER_MM = 8;

function clampExportPixelsPerMm(pixelsPerMm: number, maxPixelsPerMm: number): number {
  return Math.min(maxPixelsPerMm, Math.max(MIN_PIXELS_PER_MM, pixelsPerMm));
}

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
  maxPixelsPerMm?: number;
}): AutoFitExportFraming {
  const viewport = {
    width: Math.max(1, Math.round(options.viewport.width)),
    height: Math.max(1, Math.round(options.viewport.height)),
  };
  const fallbackCamera = options.fallbackCamera;
  const layoutBounds = options.layoutBounds;
  const innerPaddingPx = Math.max(0, Math.round(options.innerPaddingPx ?? DEFAULT_INNER_PADDING_PX));
  const maxPixelsPerMm = Math.max(
    MIN_PIXELS_PER_MM,
    options.maxPixelsPerMm ?? DEFAULT_MAX_EXPORT_PIXELS_PER_MM
  );

  if (!layoutBounds) {
    return {
      camera: fallbackCamera,
      viewport,
      isAutoFitApplied: false,
    };
  }

  const availableWidthPx = Math.max(1, viewport.width - innerPaddingPx * 2);
  const availableHeightPx = Math.max(1, viewport.height - innerPaddingPx * 2);
  const rotationRadians =
    (Math.abs(normalizeCanvasRotationDegrees(fallbackCamera.rotationDegrees)) * Math.PI) / 180;
  const rotatedWidthMm =
    Math.abs(layoutBounds.width * Math.cos(rotationRadians)) +
    Math.abs(layoutBounds.height * Math.sin(rotationRadians));
  const rotatedHeightMm =
    Math.abs(layoutBounds.width * Math.sin(rotationRadians)) +
    Math.abs(layoutBounds.height * Math.cos(rotationRadians));
  const widthFitScale =
    rotatedWidthMm > 0 ? availableWidthPx / rotatedWidthMm : Number.POSITIVE_INFINITY;
  const heightFitScale =
    rotatedHeightMm > 0 ? availableHeightPx / rotatedHeightMm : Number.POSITIVE_INFINITY;
  const fitPixelsPerMm = Math.min(widthFitScale, heightFitScale);
  const pixelsPerMm = clampExportPixelsPerMm(
    Number.isFinite(fitPixelsPerMm) ? fitPixelsPerMm : fallbackCamera.pixelsPerMm,
    maxPixelsPerMm
  );

  return {
    camera: {
      xMm: layoutBounds.centerX,
      yMm: layoutBounds.centerY,
      pixelsPerMm,
      rotationDegrees: normalizeCanvasRotationDegrees(fallbackCamera.rotationDegrees),
    },
    viewport,
    isAutoFitApplied: true,
  };
}
