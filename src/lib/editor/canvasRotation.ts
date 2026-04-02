export const DEFAULT_CANVAS_ROTATION_DEGREES = 0;
export const CANVAS_ROTATION_SNAP_FINE_DEGREES = 5;
export const CANVAS_ROTATION_SNAP_COARSE_DEGREES = 15;

export function normalizeCanvasRotationDegrees(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CANVAS_ROTATION_DEGREES;

  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.abs(normalized) < 0.0001 ? DEFAULT_CANVAS_ROTATION_DEGREES : normalized;
}

export function getShortestCanvasRotationDeltaDegrees(from: number, to: number): number {
  return normalizeCanvasRotationDegrees(to - from);
}

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
