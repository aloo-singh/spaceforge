export const DEFAULT_CANVAS_ROTATION_DEGREES = 0;
export const CANVAS_ROTATION_SNAP_FINE_DEGREES = 15;
export const CANVAS_ROTATION_SNAP_COARSE_DEGREES = 15;

export function normalizeCanvasRotationDegrees(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CANVAS_ROTATION_DEGREES;

  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.abs(normalized) < 0.0001 ? DEFAULT_CANVAS_ROTATION_DEGREES : normalized;
}

export function getShortestCanvasRotationDeltaDegrees(from: number, to: number): number {
  return normalizeCanvasRotationDegrees(to - from);
}

/**
 * Snaps a rotation value to the nearest of the four cardinal positions used
 * for interior assets: 0°, 90°, 180°, -90°.
 * This is the canonical value set for asset rotations — no other values are valid.
 */
export function snapToCardinalRotationDegrees(value: number): number {
  const normalized = normalizeCanvasRotationDegrees(value);
  // Find nearest of 0, 90, 180, -90 by rounding to nearest 90
  const snapped = Math.round(normalized / 90) * 90;
  return normalizeCanvasRotationDegrees(snapped);
}

/** Duration for a single asset rotation animation, in milliseconds. */
export const ASSET_ROTATION_DURATION_MS = 200;

/**
 * Describes an in-progress rotation animation for a single interior asset.
 *
 * Because the data model swaps widthMm ↔ depthMm at the moment of rotation,
 * `baseWidthMm` / `baseDepthMm` store a single canonical width/depth pair for
 * the whole animation. That pair is chosen so the same rotated rectangle
 * matches both the starting and ending cardinal footprints as the angle
 * interpolates between them.
 */
export type AssetRotationAnimation = {
  /** The room the asset belongs to. */
  roomId: string;
  /** The asset being animated. */
  assetId: string;
  /** Cardinal angle the asset is rotating FROM (pre-swap). */
  fromDegrees: number;
  /** Cardinal angle the asset is rotating TO (post-swap, matches stored value). */
  toDegrees: number;
  /** Canonical animation width used by the rotation matrix for every frame. */
  baseWidthMm: number;
  /** Canonical animation depth used by the rotation matrix for every frame. */
  baseDepthMm: number;
  /** Timestamp (performance.now()) when the animation started. */
  startMs: number;
  /** Total animation duration in milliseconds. */
  durationMs: number;
};

export function snapCanvasRotationDegrees(
  value: number,
  incrementDegrees = CANVAS_ROTATION_SNAP_FINE_DEGREES
): number {
  if (incrementDegrees <= 0) {
    return normalizeCanvasRotationDegrees(value);
  }

  return normalizeCanvasRotationDegrees(Math.round(value / incrementDegrees) * incrementDegrees);
}

export function formatCanvasRotationDegrees(value: number): string {
  const normalized = normalizeCanvasRotationDegrees(value);
  const rounded = Math.round(normalized);
  return `${rounded === 0 ? 0 : rounded}°`;
}

export function formatCanvasRotationShortcutLabel(): string {
  return `Shift snaps ${CANVAS_ROTATION_SNAP_FINE_DEGREES}° / ${CANVAS_ROTATION_SNAP_COARSE_DEGREES}°`;
}
