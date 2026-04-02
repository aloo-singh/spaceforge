export const DEFAULT_NORTH_BEARING_DEGREES = 0;
export const NORTH_BEARING_SNAP_DEGREES = 5;

export function normalizeNorthBearingDegrees(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NORTH_BEARING_DEGREES;

  const normalized = value % 360;
  const wrapped = normalized < 0 ? normalized + 360 : normalized;
  return Math.round(wrapped);
}

export function snapNorthBearingDegrees(value: number): number {
  return normalizeNorthBearingDegrees(
    Math.round(value / NORTH_BEARING_SNAP_DEGREES) * NORTH_BEARING_SNAP_DEGREES
  );
}

export function getNorthBearingDegreesFromScreenDelta(delta: { x: number; y: number }): number {
  return normalizeNorthBearingDegrees((Math.atan2(delta.x, -delta.y) * 180) / Math.PI);
}

export function formatNorthBearingDegrees(value: number): string {
  return `${normalizeNorthBearingDegrees(value)}°`;
}
